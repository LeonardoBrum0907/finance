import type { ManagedAccountDTO } from "@finance/shared";
import { managedAccountDisplayLabel } from "@finance/shared";
import { accountKindTone } from "./accounts";
import { SIMULATOR_TONE } from "./tokens";

interface Props {
  account: ManagedAccountDTO;
}

export function AccountKindBadge({ account }: Props) {
  const tone = SIMULATOR_TONE[accountKindTone(account)];

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${tone.box} ${tone.value}`}
    >
      {managedAccountDisplayLabel(account)}
    </span>
  );
}
