async function init() {
    try {
        // Load geographic data
        let us = await d3.json("./data/states-albers-10m.json");
        let weather_data = await d3.csv("./data/weather.csv")
        
        // Verify data loading
        console.log('map data:', us.objects.states);
        console.log('weather data:', weather_data);
        
        // Create visualization
        createVis(us, weather_data);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}


function createVis(us, data) {
    const width = 975;
    const height = 610;

    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", zoomed);

    const svg = d3.select('#vis').append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto;");
    
    const path = d3.geoPath();

    const g = svg.append("g");

    const states = g.append("g")
        .attr("fill", "#ddd")
        //.attr("cursor", "pointer")
        .selectAll("path")
        .data(topojson.feature(us, us.objects.states).features)
        .join("path")
        .attr("d", path);
  
    states.append("title")
        .text(d => d.properties.name);

    g.append("path")
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-linejoin", "round")
        .attr("d", path(topojson.mesh(us, us.objects.states, (a, b) => a !== b)));
    
    function zoomed(event) {
        const {transform} = event;
        g.attr("transform", transform);
        g.attr("stroke-width", 1 / transform.k);
    }
    
    svg.call(zoom);
}


window.addEventListener('load', init)