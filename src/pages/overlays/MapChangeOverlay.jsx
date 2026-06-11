import { useEffect, useState } from "react";
import { getCurrentOverlayData } from "../../services/api";
import "../../styles/overlays/overlay-base.css";
import "../../styles/overlays/map-change-overlay.css";

function MapChangeOverlay() {
  const [data, setData] = useState({ map: null });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const overlayData = await getCurrentOverlayData();
        if (isMounted) {
          setData(overlayData);
        }
      } catch (error) {
        if (isMounted) {
          setData({ map: null });
        }
      }
    };

    loadData();
    const timer = setInterval(loadData, 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const map = data.map || {};

  return (
    <div className="overlay-canvas overlay-stage">
      <div className="overlay-text map-change-name">{map.name || ""}</div>
      {map.icon_path && <img className="map-change-icon" src={map.icon_path} alt="Map" />}
    </div>
  );
}

export default MapChangeOverlay;
