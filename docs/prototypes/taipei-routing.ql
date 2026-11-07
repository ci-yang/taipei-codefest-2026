[out:xml][timeout:240];
relation(1293250)->.city;
.city map_to_area->.cityarea;
way(area.cityarea)
  [highway~"^(primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|living_street|unclassified|service|pedestrian|footway|path|steps|track)$"]
  ->.roads;
(.roads;node(w.roads););
out body;
