import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { OptionsPage } from './OptionsPage.tsx';
import { DEFAULT_SECTION, isSectionId } from './sections.ts';

const rootRoute = createRootRoute();

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // TanStack Router の redirect は Response を投げて遷移させる設計。Error ではない
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({ to: '/$section', params: { section: DEFAULT_SECTION } });
  },
});

const sectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$section',
  beforeLoad: ({ params }) => {
    if (isSectionId(params.section)) return;
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({ to: '/$section', params: { section: DEFAULT_SECTION } });
  },
  component: OptionsPage,
});

// 拡張ページの URL はサーバを持たないので hash history（tech-stack.md §3.4）
export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, sectionRoute]),
  history: createHashHistory(),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
