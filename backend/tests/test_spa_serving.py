from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from expense_tracker.api.app import create_app


@pytest.mark.asyncio
async def test_spa_serves_index_html_and_fallback(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # 1. Create a dummy frontend dist structure
    dist_dir = tmp_path / "frontend_dist"
    dist_dir.mkdir()
    index_file = dist_dir / "index.html"
    index_file.write_text("<!DOCTYPE html><html><body><div id='root'>PaisaIQ</div></body></html>")

    manifest_file = dist_dir / "manifest.json"
    manifest_file.write_text('{"name": "PaisaIQ"}')

    assets_dir = dist_dir / "assets"
    assets_dir.mkdir()
    css_file = assets_dir / "style.css"
    css_file.write_text("body { background: #051F20; }")

    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))
    monkeypatch.setenv("ENABLE_SCHEDULER", "0")

    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Root path should return index.html
        resp = await client.get("/")
        assert resp.status_code == 200
        assert "PaisaIQ" in resp.text
        assert "text/html" in resp.headers.get("content-type", "")

        # Direct file request (manifest.json) should return the specific file
        resp_manifest = await client.get("/manifest.json")
        assert resp_manifest.status_code == 200
        assert "PaisaIQ" in resp_manifest.text

        # Asset mount request should return the asset
        resp_css = await client.get("/assets/style.css")
        assert resp_css.status_code == 200
        assert "#051F20" in resp_css.text

        # Client-side router path (e.g. /inbox or /expenses) should fall back to index.html
        resp_spa = await client.get("/inbox")
        assert resp_spa.status_code == 200
        assert "PaisaIQ" in resp_spa.text

        # API routes must not be hijacked by SPA handler
        resp_api = await client.get("/api/v1/system/health")
        assert resp_api.status_code == 401  # Requires X-API-Key
