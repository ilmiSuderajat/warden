"use client";

import { usePathname } from "next/navigation";
import SearchBar from "./SearchBar";

export default function ConditionalSearchBar() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) return null;

  return <SearchBar />;
}