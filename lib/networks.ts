import { notFound } from "next/navigation";

/** URL segment for the network a data page reads: /mainnet/... or /testnet/... */
export const NETS = ["mainnet", "testnet"] as const;
export type NetSlug = (typeof NETS)[number];

export function isNet(s: string | undefined): s is NetSlug {
  return s === "mainnet" || s === "testnet";
}

/** The network named by the first path segment, or null on pages outside /[network]. */
export function netFromPath(path: string): NetSlug | null {
  const seg = path.split("/")[1];
  return isNet(seg) ? seg : null;
}

/** The same page on the other network: /mainnet/nodes ↔ /testnet/nodes. */
export function switchNetPath(path: string, to: NetSlug): string {
  const parts = path.split("/");
  if (!isNet(parts[1])) return `/${to}`;
  parts[1] = to;
  return parts.join("/");
}

export type NetParams = { params: { network: string } };

/** The page's network, or a 404 for any other first segment. */
export function netParam({ params }: NetParams): NetSlug {
  if (!isNet(params.network)) notFound();
  return params.network;
}

/** Page title with the network, e.g. "Nodes · Testnet · GERO · physical randomness on X1". */
export function netMetadata(title: string) {
  return ({ params }: NetParams) => ({
    title: isNet(params.network) ? `${title} · ${params.network === "mainnet" ? "Mainnet" : "Testnet"}` : title,
  });
}
