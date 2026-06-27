import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
   CategoryChartSelection,
   DashboardMonths,
   DashboardSummary,
   PeriodMode,
   PersonDTO,
   UserSettingsDTO,
} from "@finance/shared";
import { isCreditAccount, isPaydayDayConfigured, parsePaydayCycleAnchor } from "@finance/shared";
import { api } from "../lib/api";
import { CreditCardList } from "../components/dashboard/CreditCardList";
import { CycleProgressCard } from "../components/dashboard/CycleProgressCard";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { GrowthChart } from "../components/dashboard/GrowthChart";
import { InsightsPanel } from "../components/dashboard/InsightsPanel";
import { PeriodSelector } from "../components/dashboard/PeriodSelector";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";
import { RecentTransactions } from "../components/dashboard/RecentTransactions";
import { StatCards } from "../components/dashboard/StatCards";
import { InvestmentSnapshot } from "../components/dashboard/InvestmentSnapshot";
import {
   AssistantAlertBanner,
   WeeklyRecapCard,
} from "../components/chat/AssistantAlertBanner";
import { HouseholdArenaCard } from "../components/dashboard/HouseholdArenaCard";
import { useAssistant } from "../lib/assistantContext";

export function DashboardPage() {
   const { setDashboardPersonFilter } = useAssistant();
   const [months, setMonths] = useState<DashboardMonths>(1);
   const [personId, setPersonId] = useState<PersonFilter>("all");
   const [periodMode, setPeriodMode] = useState<PeriodMode>("calendar");
   const [categorySelection, setCategorySelection] = useState<CategoryChartSelection | null>(null);
   const [selectedCycleKey, setSelectedCycleKey] = useState<string | null>(null);
   const transactionsRef = useRef<HTMLElement>(null);

   const settings = useQuery({
      queryKey: ["settings"],
      queryFn: () => api.get<UserSettingsDTO>("/api/settings"),
   });

   useEffect(() => {
      if (settings.data?.paydayConfigured) {
         setPeriodMode(settings.data.defaultPeriodMode);
      }
   }, [settings.data?.defaultPeriodMode, settings.data?.paydayConfigured]);

   const handleCategorySelect = useCallback((selection: CategoryChartSelection) => {
      setCategorySelection(selection);
      requestAnimationFrame(() => {
         transactionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
   }, []);

   const handleClearCategorySelection = useCallback(() => {
      setCategorySelection(null);
   }, []);

   const people = useQuery({
      queryKey: ["people"],
      queryFn: () => api.get<PersonDTO[]>("/api/people"),
   });

   const paydayConfigured = useMemo(() => {
      const list = people.data ?? [];
      if (personId !== "all") {
         const person = list.find((p) => p.id === personId);
         return (
            isPaydayDayConfigured(person?.paydayDay) ||
            isPaydayDayConfigured(settings.data?.paydayDay)
         );
      }
      const configured = list.filter((p) => isPaydayDayConfigured(p.paydayDay));
      if (configured.length === 0) {
         return isPaydayDayConfigured(settings.data?.paydayDay);
      }
      const uniqueDays = new Set(configured.map((p) => p.paydayDay));
      const uniqueAnchors = new Set(
         configured.map((p) => parsePaydayCycleAnchor(p.paydayCycleAnchor)),
      );
      return uniqueDays.size === 1 && uniqueAnchors.size === 1;
   }, [people.data, personId, settings.data?.paydayDay]);

   const effectivePeriodMode =
      periodMode === "payday" && paydayConfigured ? "payday" : "calendar";

   const dashboardParams = new URLSearchParams({ months: String(months) });
   if (personId !== "all") dashboardParams.set("personId", personId);
   if (effectivePeriodMode === "payday") dashboardParams.set("periodMode", "payday");

   const dashboard = useQuery({
      queryKey: ["dashboard", months, personId, effectivePeriodMode],
      queryFn: () => api.get<DashboardSummary>(`/api/dashboard?${dashboardParams}`),
      enabled: settings.isSuccess,
   });

   const data = dashboard.data;
   const hasCreditCards = data?.accounts.some((acc) => isCreditAccount(acc.type)) ?? false;
   const showCycleCard =
      data?.currentCycle && data.paydayDay !== null && effectivePeriodMode === "payday";

   const cycleOptions = data?.recentCycles ?? (data?.currentCycle ? [data.currentCycle] : []);

   const activeCycleKey = useMemo(() => {
      if (selectedCycleKey && cycleOptions.some((c) => c.cycleKey === selectedCycleKey)) {
         return selectedCycleKey;
      }
      return cycleOptions[cycleOptions.length - 1]?.cycleKey ?? null;
   }, [cycleOptions, selectedCycleKey]);

   const displayCycle = useMemo(
      () => cycleOptions.find((c) => c.cycleKey === activeCycleKey) ?? data?.currentCycle,
      [cycleOptions, activeCycleKey, data?.currentCycle],
   );

   useEffect(() => {
      setSelectedCycleKey(null);
   }, [months, personId, effectivePeriodMode]);

   useEffect(() => {
      setDashboardPersonFilter(personId);
   }, [personId, setDashboardPersonFilter]);

   const effectivePersonId = personId === "all" ? undefined : personId;

   return (
      <div className="space-y-8">
         <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
               <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                  Painel Geral
               </h1>
               <p className="mt-1 text-sm text-muted-foreground-dark">
                  Visão consolidada das suas finanças com comparativos por período.
               </p>
            </div>
            {data && (data.accounts.length > 0 || data.investments.positionCount > 0) && (
               <div className="flex flex-wrap items-center gap-3">
                  <PersonSelector
                     value={personId}
                     people={people.data ?? []}
                     onChange={setPersonId}
                  />
                  <PeriodSelector
                     value={months}
                     onChange={setMonths}
                     periodMode={effectivePeriodMode}
                     onPeriodModeChange={setPeriodMode}
                     paydayConfigured={paydayConfigured}
                  />
               </div>
            )}
         </div>

         {!paydayConfigured && settings.isSuccess && people.isSuccess && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
               {personId !== "all" ? (
                  <>
                     Configure o dia de recebimento desta pessoa em{" "}
                     <a href="/configuracoes" className="font-medium underline">
                        Configurações
                     </a>{" "}
                     para usar o modo &quot;Meu ciclo&quot;.
                  </>
               ) : people.data && people.data.length > 1 ? (
                  <>
                     Na visão de todas as pessoas, o modo ciclo só está disponível quando todos têm o
                     mesmo dia de pagamento e a mesma posição no ciclo. Selecione uma pessoa ou ajuste em{" "}
                     <a href="/configuracoes" className="font-medium underline">
                        Configurações
                     </a>
                     .
                  </>
               ) : (
                  <>
                     Configure o dia de recebimento em{" "}
                     <a href="/configuracoes" className="font-medium underline">
                        Configurações
                     </a>{" "}
                     para usar o modo &quot;Meu ciclo&quot;.
                  </>
               )}
            </div>
         )}

         {dashboard.isLoading || settings.isLoading ? (
            <DashboardSkeleton />
         ) : dashboard.isError ? (
            <div className="rounded-xl border border-danger-border bg-danger-muted p-6 text-sm text-danger">
               Não foi possível carregar o painel. Tente novamente em instantes.
            </div>
         ) : !data || (data.accounts.length === 0 && data.investments.positionCount === 0) ? (
            <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-10 text-center">
               <p className="text-sm font-medium text-foreground/90">
                  Nenhuma conta conectada ainda
               </p>
               <p className="mt-1 text-sm text-muted-foreground-dark">
                  Cadastre em <strong>Pessoas</strong> e conecte em <strong>Contas</strong>.
               </p>
            </div>
         ) : (
            <>
               <AssistantAlertBanner />

               {showCycleCard && data.paydayDay !== null && displayCycle && activeCycleKey && (
                  <CycleProgressCard
                     cycle={displayCycle}
                     cycles={cycleOptions}
                     currencyCode={data.currencyCode}
                     paydayDay={data.paydayDay}
                     paydayCycleAnchor={data.paydayCycleAnchor}
                     selectedCycleKey={activeCycleKey}
                     onSelectCycle={setSelectedCycleKey}
                  />
               )}

               <StatCards
                  netWorth={data.netWorth}
                  currencyCode={data.currencyCode}
                  period={data.period}
                  previousPeriod={data.previousPeriod}
                  periodMode={effectivePeriodMode}
                  personId={effectivePersonId}
               />

               <InvestmentSnapshot
                  investments={data.investments}
                  currencyCode={data.currencyCode}
               />

               <GrowthChart
                  data={data.monthlySeries}
                  months={months}
                  currencyCode={data.currencyCode}
                  growthMetrics={data.growthMetrics}
                  categories={data.categories}
                  previousCategories={data.previousCategories}
                  periodLabel={data.period.label}
                  periodMode={effectivePeriodMode}
                  hideIncomeBreakdown={Boolean(showCycleCard)}
                  onCategorySelect={handleCategorySelect}
                  personId={effectivePersonId}
               />

               <div className="grid gap-8 lg:grid-cols-2">
                  <InsightsPanel insights={data.insights} personId={effectivePersonId} />
                  <div className="flex flex-col gap-4">
                     <WeeklyRecapCard />
                     {hasCreditCards && <CreditCardList accounts={data.accounts} />}
                  </div>
               </div>

               <HouseholdArenaCard />


               <RecentTransactions
                  personId={personId}
                  dashboardMonths={months}
                  categorySelection={categorySelection}
                  onClearCategorySelection={handleClearCategorySelection}
                  sectionRef={transactionsRef}
               />
            </>
         )}
      </div>
   );
}
