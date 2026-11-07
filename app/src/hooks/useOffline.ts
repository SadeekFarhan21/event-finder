// The offline signal from lib/net as React state, for anything that has to make room for the
// offline banner (or wait until it's gone).
import { useEffect, useState } from "react";
import { isOffline, onNetworkChange } from "../lib/net";

export function useOffline() {
  const [offline, setOffline] = useState(isOffline());
  useEffect(() => onNetworkChange(setOffline), []);
  return offline;
}
