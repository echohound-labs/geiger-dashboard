import { Addr, Table } from "./ui";
import { int, slotsToDuration } from "@/lib/format";
import type { OpenRequest } from "@/lib/chain";

/** Open randomness requests: explorer link, request slot, age at `slot`, and the grid line they are bound to. */
export function RequestTable({ requests, href, slot }: { requests: OpenRequest[]; href: (address: string) => string; slot: number }) {
  return (
    <Table
      head={["Request", "Request slot", "Age", "Line · mask"]}
      rows={requests.map((r) => [
        <a key="r" className="underline decoration-term-line" href={href(r.address)} target="_blank" rel="noreferrer">
          <Addr value={r.address} />
        </a>,
        int(r.requestSlot),
        `${int(Math.max(0, slot - Number(r.requestSlot)))} slots (≈ ${slotsToDuration(Math.max(0, slot - Number(r.requestSlot)))})`,
        r.mask === 0 ? <span key="l" className="text-term-text3">none (pre-v9)</span> : `${int(r.line)} · ${r.mask.toString(2).padStart(8, "0")}`,
      ])}
    />
  );
}
