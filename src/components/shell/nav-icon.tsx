import { CompassIcon, GridIcon, HomeIcon, StarIcon } from "../icons";
import type { NavIcon as NavIconName } from "./nav";

export function NavIcon({ name, active, size = 24 }: { name: NavIconName; active: boolean; size?: number }) {
  switch (name) {
    case "home":
      return <HomeIcon filled={active} size={size} />;
    case "grid":
      return <GridIcon filled={active} size={size} />;
    case "compass":
      return <CompassIcon filled={active} size={size} />;
    case "star":
      return <StarIcon filled={active} size={size} />;
  }
}
