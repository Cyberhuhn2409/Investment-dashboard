import { NotFoundState } from "@/components/states";

export default function NotFound() {
  return (
    <NotFoundState
      title="Wert nicht gefunden"
      text="Dieses Symbol gehört nicht zum Signal-Universum (~150 US-Large-Caps und DAX 40). Suche nach Name oder Ticker."
    />
  );
}
