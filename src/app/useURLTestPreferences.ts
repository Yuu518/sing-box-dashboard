import { useEffect, useState } from "react";

import { watchStoredValues } from "../lib/storage";
import { loadURLTestPreferences, URL_TEST_PREFERENCES_EVENT } from "./urlTestPreferences";

export function useURLTestPreferences() {
  const [preferences, setPreferences] = useState(loadURLTestPreferences);
  useEffect(() => {
    const update = () => setPreferences(loadURLTestPreferences());
    const unwatch = watchStoredValues(update);
    window.addEventListener(URL_TEST_PREFERENCES_EVENT, update);
    update();
    return () => {
      unwatch();
      window.removeEventListener(URL_TEST_PREFERENCES_EVENT, update);
    };
  }, []);
  return preferences;
}
