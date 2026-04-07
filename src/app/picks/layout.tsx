/**
 * /picks layout with a parallel `@modal` slot.
 *
 * The slot enables intercepting routes — clicking a card link from this
 * page renders the card detail in an overlay (via /picks/@modal/(..)cards/[id])
 * while keeping the list page mounted underneath. Browser back closes the
 * modal without re-rendering the list, so scroll position and pagination
 * state are naturally preserved.
 *
 * Direct navigation to /cards/[id] (refresh, share link) still hits the
 * standalone src/app/cards/[id]/page.tsx as a regular full page.
 */
export default function PicksLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
