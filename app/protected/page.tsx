"use client";

import NetWorthCard from "@/components/features/net-worth-card";
import AtAGlanceCard from "@/components/features/at-a-glance-card";
import { PageContainer, PageStack } from "@/components/layout/page-container";

/**
 * Home answers two questions and no others: is this month on track, and what
 * is everything worth. Everything else lives on the pages you visit on purpose.
 */
export default function HomePage() {
  return (
    <PageContainer title="Home">
      <PageStack>
        <NetWorthCard />
        <AtAGlanceCard />
      </PageStack>
    </PageContainer>
  );
}
