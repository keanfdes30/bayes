from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import numpy as np
import networkx as nx
from itertools import combinations

app = Flask(__name__)
CORS(app)

class JunctionTree:
    def __init__(self, network):
        self.network = network
        self.nodes = network["nodes"]
        self.edges = network["edges"]
        self.g = nx.DiGraph()
        self.cliques = []
    
    def initialize_graph(self):
        for node in self.nodes:
            self.g.add_node(node["id"])
        for edge in self.edges:
            self.g.add_edge(edge["from"], edge["to"])
        return self.g

    def get_parents(self, node_id):
        """Get parents of a given node"""
        parents = []
        for edge in self.edges:
            if edge["to"] == node_id:
                parents.append(edge["from"])
        return parents

    def moralize(self, graph):
        """Moralize the directed graph by:
        1. Connecting all parents of each node
        2. Converting to undirected graph"""
        
        # Create a copy of the graph to moralize
        moral_graph = self.g.to_undirected()

        # For each node in the graph
        for node in self.nodes:
            node_id = node["id"]
            # Get parents of current node
            parents = self.get_parents(node_id)
            
            # Connect all parents to each other
            for i in range(len(parents)):
                for j in range(i + 1, len(parents)):
                    moral_graph.add_edge(parents[i], parents[j])

        print("Original edges:", list(self.g.edges()))
        print("Moralized edges:", list(moral_graph.edges()))
        return moral_graph
    
    def get_elimination_ordering(self, graph):
        """Get elimination ordering based on minimum degree heuristic"""
        G = graph.copy()
        ordering = []
        degrees = dict(G.degree())
        
        while degrees:
            # Find node with minimum degree
            min_node = min(degrees.items(), key=lambda x: x[1])[0]
            ordering.append(min_node)
            
            # Connect all neighbors of the eliminated node
            neighbors = list(G.neighbors(min_node))
            for i in range(len(neighbors)):
                for j in range(i + 1, len(neighbors)):
                    G.add_edge(neighbors[i], neighbors[j])
            
            # Remove the node and update degrees
            G.remove_node(min_node)
            degrees = dict(G.degree())
            
        return ordering

    def triangulate(self, moral_graph):
        triangulated = moral_graph.copy()

        ordering = self.get_elimination_ordering(moral_graph)

                # Add edges based on elimination ordering
        for node in ordering:
            # Get neighbors that come later in the ordering
            neighbors = [n for n in triangulated.neighbors(node) 
                       if n in set(ordering[ordering.index(node)+1:])]
            
            # Connect all these neighbors to each other
            for i in range(len(neighbors)):
                for j in range(i + 1, len(neighbors)):
                    triangulated.add_edge(neighbors[i], neighbors[j])
        
        print("Moral edges:", list(moral_graph.edges()))
        print("Triangulated edges:", list(triangulated.edges()))
        return triangulated

    def find_maximal_cliques(self, triangulated_graph):
        """Find maximal cliques in the triangulated graph"""
        # Use NetworkX's implementation of Bron-Kerbosch algorithm
        maximal_cliques = list(nx.find_cliques(triangulated_graph))
        
        # Sort cliques by size in descending order
        maximal_cliques.sort(key=len, reverse=True)
        
        # Store cliques as a class attribute
        self.cliques = maximal_cliques
        
        # Create a string representation of each clique for printing
        clique_strings = []
        for i, clique in enumerate(maximal_cliques):
            clique_str = f"Clique {i + 1}: {sorted(clique)}"
            clique_strings.append(clique_str)
            
        print("Maximal cliques found:", len(maximal_cliques))
        print("\n".join(clique_strings))
        
        return maximal_cliques

    def get_clique_graph(self):
        """Create graph where nodes are cliques and edges show shared variables"""
        clique_graph = nx.Graph()
        
        # Add nodes for each clique
        for i, clique in enumerate(self.cliques):
            clique_graph.add_node(i, nodes=set(clique))
        
        # Add edges between cliques that share variables
        for i, j in combinations(range(len(self.cliques)), 2):
            shared_nodes = (clique_graph.nodes[i]['nodes'] & 
                          clique_graph.nodes[j]['nodes'])
            if shared_nodes:  # If cliques share any nodes
                # Weight is number of shared nodes
                clique_graph.add_edge(i, j, weight=len(shared_nodes),
                                    shared_nodes=shared_nodes)
        
        return clique_graph

    def build_junction_tree(self, clique_graph):
        """Build junction tree using maximum spanning tree"""
        # Create maximum spanning tree
        # Note: since networkx's maximum_spanning_tree finds the maximum weight tree,
        # we don't need to negate the weights
        junction_tree = nx.maximum_spanning_tree(clique_graph)
        
        # Store separator sets
        separator_sets = {}
        for i, j in junction_tree.edges():
            separator_sets[(i, j)] = junction_tree.edges[i, j]['shared_nodes']
        
        # Store the junction tree and separator sets
        self.junction_tree = junction_tree
        self.separator_sets = separator_sets
        
        # Print information about the junction tree
        print("\nJunction Tree Information:")
        print(f"Number of nodes (cliques): {len(junction_tree.nodes())}")
        print(f"Number of edges: {len(junction_tree.edges())}")
        print("\nSeparator Sets:")
        for (i, j), separator in separator_sets.items():
            print(f"Between cliques {i} and {j}: {sorted(separator)}")
        
        return junction_tree

@app.route('/network', methods=['POST'])
def process_network():
    network = request.json
    
    # Create and initialize junction tree
    jt = JunctionTree(network)
    graph = jt.initialize_graph()
    moral_graph = jt.moralize(graph)
    triangulated = jt.triangulate(moral_graph)
    maximal_cliques = jt.find_maximal_cliques(triangulated)
    clique_graph = jt.get_clique_graph()
    junction_tree = jt.build_junction_tree(clique_graph)
    return ""

if __name__ == '__main__':
    app.run(port=5000, debug=True)
