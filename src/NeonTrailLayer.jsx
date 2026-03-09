import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

export default function NeonTrailLayer({ trails = {}, territories = {}, color = "#00f3ff" }) {

  const map = useMap();
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const trailsRef = useRef(trails);
  const territoriesRef = useRef(territories);

  useEffect(() => {
    trailsRef.current = trails;
    territoriesRef.current = territories;
  }, [trails, territories]);

  useEffect(() => {

    if (!map) return;

    const pane = map.getPanes().overlayPane;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = 450;

    pane.appendChild(canvas);
    canvasRef.current = canvas;

    function resize() {

      const size = map.getSize();

      canvas.width = size.x;
      canvas.height = size.y;
      tempCanvas.width = size.x;
      tempCanvas.height = size.y;

    }

    resize();

    map.on("resize", resize);

    function syncCanvas() {

      const bounds = map.getBounds();
      const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());

      canvas.style.transform =
        `translate3d(${topLeft.x}px, ${topLeft.y}px, 0)`;

    }

    function drawTrail(points, trailColor){

      if (!points || points.length < 2) return;

      ctx.beginPath();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      const bounds = map.getBounds();
      const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());

      const getPt = (pt) => {
        const latLng = L.latLng(pt[0], pt[1]);
        const layerPt = map.latLngToLayerPoint(latLng);
        return { x: layerPt.x - topLeft.x, y: layerPt.y - topLeft.y };
      };

      const pts = points.map(getPt);

      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }

      // curve through the last two points
      if (pts.length > 2) {
        ctx.quadraticCurveTo(
          pts[pts.length - 2].x,
          pts[pts.length - 2].y,
          pts[pts.length - 1].x,
          pts[pts.length - 1].y
        );
      } else {
        ctx.lineTo(pts[1].x, pts[1].y);
      }

      ctx.strokeStyle = trailColor;
      ctx.lineWidth = 14;
      ctx.shadowBlur = 12;
      ctx.shadowColor = trailColor;
      ctx.globalAlpha = 1.0;
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.7;
      ctx.stroke();

    }

    function drawTerritoryPath(pts, targetCtx) {
      if (pts.length < 2) return;
      targetCtx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        targetCtx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }

      if (pts.length > 2) {
        targetCtx.quadraticCurveTo(
          pts[pts.length - 2].x,
          pts[pts.length - 2].y,
          pts[pts.length - 1].x,
          pts[pts.length - 1].y
        );
      } else {
        targetCtx.lineTo(pts[1].x, pts[1].y);
      }
    }

    function draw() {

      syncCanvas();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

      const bounds = map.getBounds();
      const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());

      Object.entries(territoriesRef.current).forEach(([id, polygonList]) => {
        if(!Array.isArray(polygonList) || polygonList.length === 0) return;
        const isEnemy = String(id) !== String(window.localPlayerId);
        const terrColor = isEnemy ? "#ff0055" : "#00f3ff";

        // FIRST PASS: Draw STROKES solid on temp canvas
        tempCtx.beginPath();
        polygonList.forEach(points => {
             if (!points || points.length < 3) return;
             const pts = points.map(pt => {
                const layerPt = map.latLngToLayerPoint(L.latLng(pt[0], pt[1]));
                return { x: layerPt.x - topLeft.x, y: layerPt.y - topLeft.y };
             });
             drawTerritoryPath(pts, tempCtx);
             tempCtx.closePath();
        });
        tempCtx.strokeStyle = terrColor;
        tempCtx.lineWidth = 14;
        tempCtx.shadowBlur = 12;
        tempCtx.shadowColor = terrColor;
        tempCtx.globalAlpha = 1.0; 
        tempCtx.stroke();

        tempCtx.strokeStyle = "#ffffff";
        tempCtx.lineWidth = 4;
        tempCtx.shadowBlur = 0;
        tempCtx.globalAlpha = 0.7;
        tempCtx.stroke();

        // SECOND PASS: ERASE EVERYTHING INSIDE THE POLYGONS
        // By filling the polygons with 'destination-out', we utterly destroy 
        // any and all strokes that fell inside the territory boundary!
        tempCtx.globalCompositeOperation = "destination-out";
        tempCtx.fill();
        tempCtx.globalCompositeOperation = "source-over";

        // THIRD PASS: Now that internal lines are gone, color the territory fill itself!
        tempCtx.fillStyle = terrColor;
        tempCtx.globalAlpha = 1.0;
        tempCtx.fill();
      });

      // Composite tempCanvas onto main canvas transparently
      ctx.globalAlpha = 0.4;
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.globalAlpha = 1.0;

      Object.entries(trailsRef.current).forEach(([id, path]) => {

  if(!Array.isArray(path)) return;

  const isEnemy = String(id) !== String(window.localPlayerId);

  drawTrail(path, isEnemy ? "#ff0055" : "#00f3ff");

});

    }

    function animate() {

      draw();
      animRef.current = requestAnimationFrame(animate);

    }

    animate();

    map.on("move", draw);
    map.on("zoom", draw);

    return () => {

      cancelAnimationFrame(animRef.current);

      map.off("resize", resize);
      map.off("move", draw);
      map.off("zoom", draw);

      if (pane.contains(canvas))
        pane.removeChild(canvas);

    };

  }, [map, color]);

  return null;
}