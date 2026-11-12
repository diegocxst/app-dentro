import type { RouteObject } from 'react-router'
import { AppLayout } from '@/layouts/AppLayout'
import { GuidePage } from '@/pages/GuidePage'
import { MorePage } from '@/pages/MorePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SectionPage } from '@/pages/SectionPage'
import { GUIDE_PATH, MORE_PATH, SECTIONS } from './navigation'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      ...SECTIONS.map((s): RouteObject =>
        s.path === '/' ? { index: true, element: <SectionPage id={s.id} /> } : { path: s.path.slice(1), element: <SectionPage id={s.id} /> },
      ),
      { path: GUIDE_PATH.slice(1), element: <GuidePage /> },
      { path: MORE_PATH.slice(1), element: <MorePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
