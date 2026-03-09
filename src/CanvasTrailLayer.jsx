import { useEffect } from "react";
import { useMap } from "react-leaflet";

export default function CanvasTrailLayer({ trails, color }) {

  const map = useMap();

  useEffect(() => {

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const pane = map.getPanes().overlayPane;

    canvas.style.position = "absolute";
    canvas.style.zIndex = 500;

    pane.appendChild(canvas);

    function resize() {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
    }

    resize();
    map.on("resize", resize);

    function draw() {

      ctx.clearRect(0,0,canvas.width,canvas.height);

      Object.values(trails).forEach(path => {

        ctx.beginPath();

        path.forEach((p,i)=>{

          const point = map.latLngToContainerPoint(p);

          if(i===0)
            ctx.moveTo(point.x,point.y);
          else
            ctx.lineTo(point.x,point.y);

        });

        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;

        ctx.stroke();

      });

    }

    draw();

    map.on("move",draw);
    map.on("zoom",draw);

    return ()=>{

      map.off("move",draw);
      map.off("zoom",draw);

      pane.removeChild(canvas);

    }

  },[trails]);

  return null;

}