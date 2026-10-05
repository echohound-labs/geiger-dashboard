import { Addr, Table } from "./ui";
import { int } from "@/lib/format";

type Req = { address: string; requestSlot: number | bigint };

/** Open randomness requests with an explorer link and, while pending, the slots left in the fulfil window. */
export function RequestTable({
  requests,
  href,
  slot,
  window,
}: {
  requests: Req[];
  href: (address: string) => string;
  /** Current slot; with `window`, adds the slots left before the request becomes cancel-only. */
  slot?: number | null;
  window?: number;
}) {
  const left = (r: Req) => (slot == null || window === undefined ? null : Number(r.requestSlot) + window - slot);
  return (
    <Table
      head={["Request", "Request slot", ...(window !== undefined ? ["Fulfil window"] : [])]}
      rows={requests.map((r) => {
        const l = left(r);
        return [
          <a key="r" className="underline decoration-term-line" href={href(r.address)} target="_blank" rel="noreferrer">
            <Addr value={r.address} />
          </a>,
          int(r.requestSlot),
          ...(window !== undefined ? [l === null ? "—" : `${int(Math.max(0, l))} slots left`] : []),
        ];
      })}
    />
  );
}
