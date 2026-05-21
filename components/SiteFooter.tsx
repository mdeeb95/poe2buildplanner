export function SiteFooter() {
  return (
    <footer className="site-footer" role="contentinfo">
      <p className="site-footer-disclaimer">
        Unofficial fan tool — not affiliated with Grinding Gear Games.
      </p>
      <p className="site-footer-links">
        <a
          href="https://github.com/mdeeb95/poe2buildplanner"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source
        </a>
        <span aria-hidden="true"> · </span>
        <a
          href="https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2"
          target="_blank"
          rel="noopener noreferrer"
        >
          Data from Path of Building
        </a>
      </p>
    </footer>
  );
}
