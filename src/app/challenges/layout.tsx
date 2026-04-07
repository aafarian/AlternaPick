/**
 * /challenges layout with a parallel `@modal` slot.
 *
 * The slot enables intercepting routes — clicking a challenge from the
 * History list renders the challenge detail in an overlay (via
 * /challenges/@modal/(.)[id]) while keeping the list page mounted
 * underneath. Browser back closes the modal without re-rendering the
 * list, so scroll position and pagination state are naturally preserved.
 *
 * Direct navigation to /challenges/[id] (refresh, share link) still
 * hits the standalone src/app/challenges/[id]/page.tsx as a regular
 * full page.
 */
export default function ChallengesLayout({
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
