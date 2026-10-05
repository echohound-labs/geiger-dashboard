import { PageTitle, Panel } from "@/components/ui";
import { netMetadata, netParam, type NetParams } from "@/lib/networks";

export const generateMetadata = netMetadata("Integrations");

export default function Page(p: NetParams) {
  const net = netParam(p);
  return (
    <>
      <PageTitle title="Integrations" network={net} sub="Consumers that request randomness from GERO." />
      <Panel note="Placeholder. Consumers that request randomness from GERO will be listed here.">
        <p className="font-mono text-sm text-term-text3">No integrations listed yet.</p>
      </Panel>
    </>
  );
}
