import { getOni } from "@/lib/data";
import { EnsoView } from "./EnsoView";

export default function EnsoPage() {
  const oni = getOni();
  return <EnsoView oni={oni} />;
}
