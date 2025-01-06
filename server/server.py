from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import numpy as np


app = Flask(__name__)
CORS(app)

@app.route('/network', methods=['POST'])
def process_network():
    network = request.json
    ordering = topsort(network)
    marginal_probs = {}
    for node_id in ordering:
        node = network["nodes"][node_id]
        node_probs = {}
        for field in node["fields"]:
            if not field["conditionalProbabilities"]:
                node_probs[field["name"]] = field["value"]
            else:
                # This is a child node - calculate using conditional probabilities
                total_prob = 0
                for cond_prob in field["conditionalProbabilities"]:
                    prob = cond_prob["value"]
                    
                    # Multiply by parent probabilities
                    parent_values = cond_prob["parentCombination"]
                    for parent_id, parent_value in zip(get_parent_nodes(node_id, network), parent_values):
                        prob *= marginal_probs[parent_id][parent_value]
                    
                    total_prob += prob
                
                node_probs[field["name"]] = total_prob
        
        marginal_probs[node_id] = node_probs
        print(f"{node['name']} marginal probabilities:", node_probs)
    response_data = {int(k): {str(key): float(value) for key, value in v.items()} for k, v in marginal_probs.items()}
    return jsonify(response_data)


def get_parent_nodes(node_id, network):
    list = []
    for edge in network["edges"]:
        if edge["to"] == node_id:
            list.append(edge["from"])

    return list

def topsort(network):
    N = len(network["nodes"])
    V = np.full(N, False)
    ordering = np.full(N, 0)
    i = N - 1

    for at in range(N):
        if V[at] == False:
            visitedNodes = []
            dfs(at, V, visitedNodes, network)
            for nodeID in visitedNodes:
                ordering[i] = nodeID
                i = i-1

    return ordering

def dfs(at, V, visitedNodes, network):

    V[at] = True
    
    edges = [edge for edge in network["edges"] if edge["from"] == at]

    for edge in edges:
        if V[edge["to"]] == False:
            dfs(edge["to"], V, visitedNodes, network)

    visitedNodes.append(at)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
