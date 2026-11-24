import { useQuery } from "@tanstack/react-query";
import type { RegistrationStatusDTO } from "@finance/shared";
import { api } from "./api";

/**
 * Diz se o servidor aceita contas novas (ALLOW_REGISTRATION na API).
 * Enquanto carrega ou se a consulta falhar, trata como fechado para não
 * oferecer um cadastro que a API vai recusar.
 *
 * @example const registrationOpen = useRegistrationOpen();
 */
export function useRegistrationOpen(): boolean {
  const { data } = useQuery({
    queryKey: ["auth", "registration"],
    queryFn: () => api.get<RegistrationStatusDTO>("/api/auth/registration"),
    staleTime: Infinity,
    retry: false,
  });
  return data?.open === true;
}
