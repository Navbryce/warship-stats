import { Component, ElementRef, EventEmitter, Input, Output  } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {sortEdges} from '../../misc-functions/edges-functions.functions'
import { arrayToMap } from '../../misc-functions/ships-functions.functions'
import * as configData from '../../../../config.json';
const config = (<any>configData);



declare var Viva: any;
@Component({
  selector: 'ship-graph',
  templateUrl: './ship-graph.component.html',
  styleUrls: ['./ship-graph.component.css']
})
export class ShipGraphComponent {

  @Input() ship: any;
  @Input() allShips: any; // Represents all the nodes
  @Output() switchShips = new EventEmitter<any>();
  graph: any; // Vivagraph object
  graphContainer: any;
  graphics: any;
  layoutRunning: boolean;
  shipEdges: Array<any>; // Stores an array of all the edges where the ship being viewed is a target or source
  shipMap: any;
  renderer: any;
  configObject = <any> config;


  // Inject HTTP client
  constructor(private http: HttpClient) {
    console.log(this.configObject.mongoIP);
  }

  ngOnChanges() {
    this.shipMap = arrayToMap(this.allShips);
  }

  ngAfterContentInit() {
    this.shipEdges = [];
    this.graphContainer = document.getElementById("ship-graph");
    this.graph = Viva.Graph.graph();
    this.drawEntireGraph();

    // Layout ensures stronger edges are, the shorter the edge
    var maximumLength = 90; // The maximum link length
    var maximumMagnitude = 30; // The maximum possible magnitude or at least treat is as the maximum
    var layout = Viva.Graph.Layout.forceDirected(this.graph, {
        springLength: maximumLength,
        springCoeff : 0.0008,
        gravity : -10,
        // This is the main part of this example. We are telling force directed
        // layout, that we want to change length of each physical spring
        // by overriding `springTransform` method:
        springTransform: function (link, spring) {
          var linkMagnitude = link.data.magnitude;
          if (linkMagnitude > maximumMagnitude) {
            linkMagnitude = 0; // If the link is stronger than the maximum magnitude, treat it as the maximum magnitude
            console.log("A link has a greater magnitude than the pre-configured magnitude of " + maximumMagnitude + " in the graph");
          }
          spring.length = maximumLength * (1 - linkMagnitude);
        }
    });
    this.graphics = this.getSvgGraphics();
    // specify where it should be rendered:
    var renderer = Viva.Graph.View.renderer(this.graph, {
      container: this.graphContainer,
      graphics: this.graphics,
      layout: layout
    });
    this.layoutRunning = true;
    this.renderer = renderer;
    renderer.run();

  }

  addAllNodes (): void { // Adds all the ships as nodes
    for (var shipCounter = 0; shipCounter < this.allShips.length; shipCounter++) {
      var ship = this.allShips[shipCounter];
      var node = {
        imageURL: ship.pictures[0].src,
        name: ship.displayName,
        scrapeURL: ship.scrapeURL,
      }
      this.addNode(node);
    }
  }

  addEdge (edge: any): void { // Assumes teh nodes have already been added
    this.graph.addLink(edge.source, edge.target, {magnitude: edge.magnitude});
  }

  addNode (node: any): void {
    this.graph.addNode(node.scrapeURL, {imageURL: node.imageURL, name: node.name});
  }

  drawEntireGraph (): void {
    this.addAllNodes(); // Adds all the ships as nodes

    // Add edges (Edges also contain the image URL which at this point is unecessary)
    var body = {}
    this.http.post('http://' + this.configObject.backendIP + ':' + this.configObject.port + '/graphs/getAllEdges', body).subscribe(edgesRes => {
      var edges = <Array<any>> edgesRes;
      console.log(edges);
      for (var edgeCounter = 0; edgeCounter < edges.length; edgeCounter++) {
        var edge = edges[edgeCounter];
        var sourceNode = {
          imageURL: edge.sourceImage.src,
          name: edge.sourceName,
          scrapeURL: edge.source,
        };
        var targetNode = {
          imageURL: edge.targetImage.src,
          name: edge.targetName,
          scrapeURL: edge.target
        };

        // If the ship being viewed is a target or source in the edge, add it to the array
        if (edge.source == this.ship.scrapeURL) { // edge.view says the target is the name we want to display (because the user is looking at the source)
          edge.view = edge.targetName;
          edge.viewURL = edge.target;
          edge.display = false; // for the accordion/hidden effect
          this.shipEdges.push(edge);
        }else if (edge.target == this.ship.scrapeURL) { // edge.view says the source is the name we want to display (because the user is looking at the target)
          edge.view = edge.sourceName;
          edge.viewURL = edge.source;
          edge.display = false; // for the accordion/hidden effect
          this.shipEdges.push(edge);
        }

        // Add nodes first
        this.addNode(sourceNode);
        this.addNode(targetNode);

        // Add edge
        this.addEdge(edge);
      }
      sortEdges(this.shipEdges); // Sorts shipEdges by magnitude . COuld be done through binary add, but I'm not going to implement that right now
      this.shipEdges = this.shipEdges.reverse();
    });
  }

  getPauseText (state: boolean): string {
    var returnString = null;
    state ? returnString = "Pause": returnString = "Resume";
    return returnString;
  }

  getSvgGraphics (): any {
    var graphics = Viva.Graph.View.svgGraphics();
    var component = this;
    graphics.node((node) => {
           // The function is called every time renderer needs a ui to display node
           var ui = Viva.Graph.svg('g');
           var label = Viva.Graph.svg('text').attr('y', '-4px').text(node.data.name);
           var image = Viva.Graph.svg('image')
                 .attr('width', 24)
                 .attr('height', 24)
                 .link(node.data.imageURL); // node.data holds custom object passed to graph.addNode();

           ui.append(label);
           ui.append(image);
           ui.addEventListener("mouseover", ()=> {
             component.highlightConnectedNodes(node.id, true);
          });
          ui.addEventListener("mouseout", ()=> {
            component.highlightConnectedNodes(node.id, false);
         });
           return ui;
         })
    graphics.placeNode((nodeUI, pos) => {
      // Shift image to let links go to the center:
      var translate = 'translate(' +(pos.x - 24/2) + ',' + (pos.y - 24/2) +')'; // 24/2 is size
      nodeUI.attr('transform', translate);
    });

    return graphics;
  }

  highlightConnectedNodes(nodeID: any, state: boolean): void { // Highlights and unhighlights based on state
    this.graph.forEachLinkedNode(nodeID, (node, edge) => {
      var linkUI = this.graphics.getLinkUI(edge.id);
      if (linkUI) { // Make sure it's not null
        linkUI.attr('stroke', state ? 'red': 'grey');
      }
    });
  }

  switchShip (ship: any): void { // Switch the ship being viewed
    this.switchShips.emit(ship);
  }

  toggleRender (): void {
    if (this.renderer != null) {
      if (this.layoutRunning) {
        this.renderer.pause();
      } else {
        this.renderer.resume();
      }
      this.layoutRunning = !this.layoutRunning; // Switch states
    }
  }
}
