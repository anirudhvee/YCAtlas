"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Company } from "@/lib/types";

const CompaniesContext = createContext<Company[]>([]);

export function useCompanies(): Company[] {
  return useContext(CompaniesContext);
}

export function CompaniesProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/companies")
      .then((r) => r.json() as Promise<Company[]>)
      .then((data) => {
        if (!cancelled) setCompanies(data);
      })
      .catch(() => {
        // leave as empty array
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CompaniesContext.Provider value={companies}>
      {children}
    </CompaniesContext.Provider>
  );
}
