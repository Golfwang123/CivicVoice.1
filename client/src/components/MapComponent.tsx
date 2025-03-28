import { useEffect, useRef } from "react";
import L from "leaflet";
import { Project } from "@/lib/types";

interface MapComponentProps {
  projects?: Project[];
  onLocationSelect?: (lat: string, lng: string) => void;
  initialLocation?: { lat: string; lng: string };
  height?: string;
}

export default function MapComponent({ 
  projects = [],
  onLocationSelect,
  initialLocation,
  height = "100%"
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  
  // Map issue types to marker colors
  const typeColorMap: Record<string, string> = {
    crosswalk: "blue",
    pothole: "red",
    sidewalk: "green",
    streetlight: "orange",
    other: "purple",
  };
  
  // Initialize the map once on component mount
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    
    // Imperial Valley, California centered location
    const imperialValleyCenter: L.LatLngTuple = [32.847, -115.566]; // Imperial Valley coordinates
    const initialZoom = 11;
    
    // Define bounds for Imperial Valley region (approx coordinates)
    const southWest: L.LatLngTuple = [32.5, -116.0]; // SW corner of Imperial Valley
    const northEast: L.LatLngTuple = [33.2, -115.0]; // NE corner of Imperial Valley
    const imperialValleyBounds = L.latLngBounds(southWest, northEast);
    
    // Create the map with max bounds restriction
    leafletMapRef.current = L.map(mapRef.current, {
      maxBounds: imperialValleyBounds,
      maxBoundsViscosity: 1.0, // Prevents dragging outside bounds
      minZoom: 10 // Prevents zooming out too far
    }).setView(imperialValleyCenter, initialZoom);
    
    // Add OpenStreetMap tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(leafletMapRef.current);
    
    // Create a layer group for markers
    markersLayerRef.current = L.layerGroup().addTo(leafletMapRef.current);
    
    // If initialLocation is provided, center the map and add a marker
    if (initialLocation) {
      const lat = parseFloat(initialLocation.lat);
      const lng = parseFloat(initialLocation.lng);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        leafletMapRef.current.setView([lat, lng], initialZoom);
        
        const marker = L.marker([lat, lng], {
          draggable: !!onLocationSelect,
        }).addTo(markersLayerRef.current!);
        
        if (onLocationSelect) {
          marker.on("dragend", function (e: L.LeafletEvent) {
            const position = marker.getLatLng();
            onLocationSelect(position.lat.toString(), position.lng.toString());
          });
        }
      }
    }
    
    // Handle clicks on the map if we're in location selection mode
    if (onLocationSelect) {
      leafletMapRef.current.on("click", function (e: L.LeafletMouseEvent) {
        const { lat, lng } = e.latlng;
        
        // Clear existing markers
        markersLayerRef.current?.clearLayers();
        
        // Add a new marker
        const marker = L.marker([lat, lng], {
          draggable: true,
        }).addTo(markersLayerRef.current!);
        
        // Call the callback with the selected location
        onLocationSelect(lat.toString(), lng.toString());
        
        // Update marker position on drag
        marker.on("dragend", function () {
          const position = marker.getLatLng();
          onLocationSelect(position.lat.toString(), position.lng.toString());
        });
      });
    }
    
    // Cleanup function
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [initialLocation, onLocationSelect]);
  
  // Update markers when projects change
  useEffect(() => {
    if (!leafletMapRef.current || !markersLayerRef.current || !projects.length) return;
    
    // Only clear if we're not in location selection mode
    if (!onLocationSelect) {
      markersLayerRef.current.clearLayers();
    }
    
    // Add markers for each project
    projects.forEach((project) => {
      const lat = parseFloat(project.latitude);
      const lng = parseFloat(project.longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;
      
      // Create custom icon based on issue type
      const markerColor = typeColorMap[project.issueType] || "gray";
      
      // Create a marker
      const marker = L.marker([lat, lng]).addTo(markersLayerRef.current!);
      
      // Add a popup with project info
      marker.bindPopup(`
        <strong>${project.title}</strong><br>
        ${project.description}<br>
        <small>${project.location}</small>
      `);
    });
    
    // Fit the map to show all markers if we have projects and aren't in selection mode
    if (projects.length > 0 && !onLocationSelect) {
      // Filter out projects with valid coordinates
      const validProjects = projects
        .filter((p) => !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude)));
      
      // Check if any valid projects exist
      if (validProjects.length > 0) {
        // Create bounds from project coordinates
        const bounds = L.latLngBounds(
          validProjects.map((p) => [parseFloat(p.latitude), parseFloat(p.longitude)] as L.LatLngTuple)
        );
        
        // Extend bounds if they're outside Imperial Valley (to keep markers visible but centered on Imperial Valley)
        // This ensures we always see markers but stay focused on Imperial Valley
        const southWest: L.LatLngTuple = [32.5, -116.0];
        const northEast: L.LatLngTuple = [33.2, -115.0];
        const imperialBounds = L.latLngBounds(southWest, northEast);
        
        // Get union of both bounds
        const unionBounds = imperialBounds.extend(bounds);
        
        // Apply bounds with padding
        if (unionBounds.isValid()) {
          leafletMapRef.current.fitBounds(unionBounds, { padding: [50, 50] });
        }
      }
    }
  }, [projects, onLocationSelect]);
  
  return <div ref={mapRef} style={{ height }} className="z-0"></div>;
}
