import React, { useState, useRef, useEffect } from 'react';

const BayesNetwork = () => {
  const [network, setNetwork] = useState({
    nodes: [],
    edges: []
  });
  const [draggedNode, setDraggedNode] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [isAddingEdge, setIsAddingEdge] = useState(false);
  const [edgeStart, setEdgeStart] = useState(null);
  const [altClickNode, setAltClickNode] = useState(null);
  const [inputValues, setInputValues] = useState([]); // Move this to the top with other states
  const [solvedProbabilities, setSolvedProbabilities] = useState(null);
  const svgRef = useRef(null);

 // Helper function to generate conditional probabilities
  const generateConditionalProbabilities = (node, network) => {
    // Get all parent nodes
    const parentNodes = network.edges
      .filter(e => e.to === node.id)
      .map(e => network.nodes.find(n => n.id === e.from))
      .filter(Boolean);

    if (parentNodes.length === 0) return [];

    // Generate all possible combinations of parent field values
    const generateCombinations = (parents, current = [], index = 0) => {
      if (index === parents.length) {
        return [current];
      }
      
      const combinations = [];
      const parentNode = parents[index];
      parentNode.fields.forEach(field => {
        combinations.push(...generateCombinations(
          parents,
          [...current, field.name],
          index + 1
        ));
      });
      return combinations;
    };

    const parentCombinations = generateCombinations(parentNodes);
    return parentCombinations.map(combination => ({
      parentCombination: combination,
      value: 0
    }));
  };

  // Handle node click for edge creation
  const handleNodeClick = (node) => {
    if (isAddingEdge) {
      if (!edgeStart) {
        setEdgeStart(node);
      } else if (node.id !== edgeStart.id) {
        // Create deep copy first
        const deepCopyNetwork = JSON.parse(JSON.stringify(network));
        
        // Add new edge
        const newEdge = {
          id: `edge-${deepCopyNetwork.edges.length + 1}`,
          from: edgeStart.id,
          to: node.id
        };
        deepCopyNetwork.edges.push(newEdge);

        // Update child node's conditional probabilities
        const childNodeIndex = deepCopyNetwork.nodes.findIndex(n => n.id === node.id);
        if (childNodeIndex !== -1) {
          const updatedChildNode = {
            ...deepCopyNetwork.nodes[childNodeIndex],
            fields: deepCopyNetwork.nodes[childNodeIndex].fields.map(field => ({
              ...field,
              conditionalProbabilities: generateConditionalProbabilities(
                deepCopyNetwork.nodes[childNodeIndex], 
                deepCopyNetwork
              )
            }))
          };
          deepCopyNetwork.nodes[childNodeIndex] = updatedChildNode;
        }

        // Set the updated network
        setNetwork(deepCopyNetwork);
        setIsAddingEdge(false);
        setEdgeStart(null);
      }
    }
  };
  // Add useEffect at component level
  useEffect(() => {
    if (altClickNode) {
      const table = generateProbabilityTable(altClickNode);
      const parents = getNodeParents(altClickNode.id);
      const isParentNode = parents.length === 0;
      
      if (isParentNode && table.rows) {
        setInputValues(table.rows.map(row => row[1] || 0));
      }
    }
  }, [altClickNode]);

  const addNode = () => {
    const newNode = {
      id: network.nodes.length ,
      name: `Node ${network.nodes.length}`,
      position: {
        x: 100 + (network.nodes.length * 100),
        y: 100
      },
      fields: []
    };
    setNetwork(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
  };

  // Add field to node
  const addField = () => {
    if (editingNode && newFieldName.trim()) {
      setNetwork(prev => {
        // First create a deep copy of the network
        const updatedNetwork = JSON.parse(JSON.stringify(prev));
        
        // Find and update the node we're adding a field to
        const nodeIndex = updatedNetwork.nodes.findIndex(n => n.id === editingNode.id);
        if (nodeIndex !== -1) {
          const node = updatedNetwork.nodes[nodeIndex];
          const fieldExists = node.fields.some(field => field.name === newFieldName.trim());
          
          if (!fieldExists) {
            // Add the new field to the node
            const newField = {
              name: newFieldName.trim(),
              value: 0,
              conditionalProbabilities: generateConditionalProbabilities(node, updatedNetwork)
            };
            node.fields.push(newField);
            
            // Find all child nodes of this node
            const childNodes = updatedNetwork.edges
              .filter(edge => edge.from === node.id)
              .map(edge => updatedNetwork.nodes.find(n => n.id === edge.to));
            
            // Update conditional probabilities for all child nodes
            childNodes.forEach(childNode => {
              if (childNode) {
                const childNodeIndex = updatedNetwork.nodes.findIndex(n => n.id === childNode.id);
                updatedNetwork.nodes[childNodeIndex] = {
                  ...childNode,
                  fields: childNode.fields.map(field => ({
                    ...field,
                    conditionalProbabilities: generateConditionalProbabilities(childNode, updatedNetwork)
                  }))
                };
              }
            });
          }
        }
        
        // Update the editing node reference
        const updatedEditingNode = updatedNetwork.nodes.find(n => n.id === editingNode.id);
        if (updatedEditingNode) {
          setEditingNode(updatedEditingNode);
        }
        
        return updatedNetwork;
      });
      setNewFieldName('');
    }
  };

  const startEdgeCreation = () => {
    setIsAddingEdge(true);
    setEdgeStart(null);
  };

  const startDragging = (e, nodeId) => {
    if (!isAddingEdge) {
      e.stopPropagation();
      setDraggedNode({
        id: nodeId,
        offset: {
          x: e.clientX,
          y: e.clientY
        }
      });
    }
  };

  const onDrag = (e) => {
    if (draggedNode && svgRef.current) {
      setNetwork(prev => ({
        ...prev,
        nodes: prev.nodes.map(node => {
          if (node.id === draggedNode.id) {
            const dx = e.clientX - draggedNode.offset.x;
            const dy = e.clientY - draggedNode.offset.y;
            
            return {
              ...node,
              position: {
                x: node.position.x + dx,
                y: node.position.y + dy
              }
            };
          }
          return node;
        })
      }));

      setDraggedNode({
        ...draggedNode,
        offset: {
          x: e.clientX,
          y: e.clientY
        }
      });
    }
  };

  const stopDragging = () => {
    setDraggedNode(null);
  };

  const openEditModal = (node) => {
    if (!isAddingEdge) {
      setEditingNode(node);
      setNewNodeName(node.name);
      setNewFieldName('');
    }
  };

  const handleSave = () => {
    if (editingNode && newNodeName.trim()) {
      setNetwork(prev => ({
        ...prev,
        nodes: prev.nodes.map(node => {
          if (node.id === editingNode.id) {
            return {
              ...node,
              name: newNodeName.trim()
            };
          }
          return node;
        })
      }));
      setEditingNode(null);
    }
  };

  const removeField = (fieldName) => {
    setNetwork(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => {
        if (node.id === editingNode.id) {
          const updatedNode = {
            ...node,
            fields: node.fields.filter(field => field.name !== fieldName)
          };
          setEditingNode(updatedNode);
          return updatedNode;
        }
        return node;
      })
    }));
  };

  const getNodeParents = (nodeId) => {
    // Get all parent nodes by looking at edges where this node is the 'to' node
    return network.edges
      .filter(edge => edge.to === nodeId)
      .map(edge => network.nodes.find(n => n.id === edge.from));
  };

   // Update probability values
  const updateProbability = (nodeId, rowId, colIndex, newValue) => {
    setNetwork(prev => {
      const updatedNodes = prev.nodes.map(node => {
        if (node.id === nodeId) {
          const parents = prev.edges
            .filter(e => e.to === nodeId)
            .map(e => prev.nodes.find(n => n.id === e.from))
            .filter(Boolean);
          
          if (parents.length === 0) {
            const updatedFields = node.fields.map((field, idx) => {
              if (idx === rowId) {
                return { ...field, value: newValue };
              }
              return field;
            });
            return { ...node, fields: updatedFields };
          } else {
            const updatedFields = node.fields.map((field, fieldIndex) => {
              if (fieldIndex === colIndex) {
                const table = generateProbabilityTable(node);
                const rowData = table.rows[rowId];
                
                if (!field.conditionalProbabilities) {
                  field.conditionalProbabilities = generateConditionalProbabilities(node, prev);
                }
                
                const probIndex = field.conditionalProbabilities.findIndex(
                  prob => JSON.stringify(prob.parentCombination) === JSON.stringify(rowData.parentValues)
                );
                
                if (probIndex === -1) {
                  field.conditionalProbabilities.push({
                    parentCombination: rowData.parentValues,
                    value: newValue
                  });
                } else {
                  field.conditionalProbabilities[probIndex].value = newValue;
                }
              }
              return field;
            });
            
            return { ...node, fields: updatedFields };
          }
        }
        return node;
      });
      
      return { ...prev, nodes: updatedNodes };
    });
  };
    // Monitor network changes
  useEffect(() => {
    console.log('Network state updated:', JSON.stringify(network, null, 2));
  }, [network]);

  const generateProbabilityTable = (node) => {
    const parents = getNodeParents(node.id);
    
    if (parents.length === 0) {
      // For parent nodes
      return {
        headers: ['Field', 'Probability'],
        rows: node.fields.map(field => [field.name, field.value || 0])
      };
    } else {
      // For child nodes
      const headers = [
        ...parents.map(parent => parent.name),
        ...node.fields.map(field => field.name)
      ];

      let rowCombinations = [];
      const generateCombinations = (parentIndex, currentComb) => {
        if (parentIndex === parents.length) {
          rowCombinations.push(currentComb);
          return;
        }
        
        const parent = parents[parentIndex];
        parent.fields.forEach(field => {
          generateCombinations(
            parentIndex + 1,
            [...currentComb, field.name]
          );
        });
      };

      generateCombinations(0, []);

      // Create rows with stored probability values
      const rows = rowCombinations.map((combination, index) => {
        const probabilities = node.fields.map(field => {
          const storedProb = field.conditionalProbabilities?.find(
            prob => JSON.stringify(prob.parentCombination) === JSON.stringify(combination)
          );
          return storedProb?.value || 0;
        });

        return {
          id: index,
          parentValues: combination,
          probabilities
        };
      });

      return {
        headers,
        rows
      };
    }
  };

  return (
    <div className="w-full h-screen bg-gray-100">
      <div className="p-4 flex gap-2">
        <button 
          onClick={addNode}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add Node
        </button>
        <button 
          onClick={startEdgeCreation}
          className={`px-4 py-2 rounded ${
            isAddingEdge 
              ? 'bg-green-500 text-white hover:bg-green-600' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isAddingEdge ? 'Adding Edge...' : 'Add Edge'}
        </button>
        <button 
          onClick={() => console.log("Current network state:", network)}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
        >
          Log Network
        </button>
        <button 
          onClick={async () => {
            try {
              const response = await fetch('http://localhost:5000/network', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(network)
              });
              const data = await response.json();
              setSolvedProbabilities(data);
            } catch (error) {
              console.error('Error sending network to server:', error);
            }
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Solve
        </button>      
      </div>

      <svg 
        ref={svgRef}
        className="w-full h-full border border-gray-300 bg-white"
        onMouseMove={onDrag}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="black" />
          </marker>
          <marker
            id="temp-arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="gray" />
          </marker>
        </defs>

        {network.edges.map((edge) => {
          const startNode = network.nodes.find(n => n.id === edge.from);
          const endNode = network.nodes.find(n => n.id === edge.to);
          if (startNode && endNode) {
            const dx = endNode.position.x - startNode.position.x;
            const dy = endNode.position.y - startNode.position.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const unitDx = dx / length;
            const unitDy = dy / length;
            const nodeRadius = 20;
            const startX = startNode.position.x + (unitDx * nodeRadius);
            const startY = startNode.position.y + (unitDy * nodeRadius);
            const endX = endNode.position.x - (unitDx * nodeRadius);
            const endY = endNode.position.y - (unitDy * nodeRadius);
            
            return (
              <line
                key={edge.id}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="black"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          }
          return null;
        })}
        
        {isAddingEdge && edgeStart && (
          <line
            x1={edgeStart.position.x}
            y1={edgeStart.position.y}
            x2={draggedNode ? draggedNode.position.x : edgeStart.position.x}
            y2={draggedNode ? draggedNode.position.y : edgeStart.position.y}
            stroke="gray"
            strokeWidth="2"
            strokeDasharray="5,5"
            markerEnd="url(#temp-arrowhead)"
          />
        )}

        {network.nodes.map((node) => (
          <g 
            key={node.id}
            onClick={() => handleNodeClick(node)}
            onMouseDown={(e) => startDragging(e, node.id)}
            style={{ cursor: isAddingEdge ? 'pointer' : 'move' }}
          >
            <circle
              cx={node.position.x}
              cy={node.position.y}
              r="20"
              fill={edgeStart?.id === node.id ? '#FFA500' : '#4CAF50'}
              stroke="black"
              strokeWidth="2"
              onDoubleClick={() => !isAddingEdge && openEditModal(node)}
              onMouseDown={(e) => {
                if (e.altKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  setAltClickNode(node);
                } else {
                  startDragging(e, node.id);
                }
              }}              
            />
            <text
              x={node.position.x}
              y={node.position.y + 35}
              textAnchor="middle"
              className="text-sm"
            >
              {node.name}
            </text>
          </g>
        ))}
      </svg>

      {editingNode && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          onClick={() => setEditingNode(null)}
        >
          <div 
            className="bg-white p-6 rounded-lg shadow-lg w-96"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 text-black">Edit Node</h3>
            
            {/* Node Name Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Node Name
              </label>
              <input
                type="text"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                className="border p-2 w-full rounded"
                autoFocus
              />
            </div>

            {/* Fields Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fields
              </label>
              <div className="space-y-2">
                {editingNode.fields.map((field, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-black">
                    <span>{field.name}</span>
                    <button
                      onClick={() => removeField(field.name)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Add Field Input */}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="New field name"
                  className="border p-2 flex-1 rounded"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addField();
                    }
                  }}
                />
                <button
                  onClick={addField}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingNode(null)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

{solvedProbabilities && (
  <div className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-lg">
    <h3 className="text-lg font-bold mb-2 text-black">Marginal Probabilities</h3>
    <div className="flex flex-wrap gap-4 text-black">
      {Object.entries(solvedProbabilities).map(([nodeId, probs]) => {
        const node = network.nodes.find(n => n.id === parseInt(nodeId));
        return (
          <div key={nodeId} className="bg-gray-100 p-2 rounded">
            <h4 className="font-semibold">{node.name}</h4>
            {Object.entries(probs).map(([field, prob]) => (
              <div key={field} className="text-sm">
                P({field}) = {prob.toFixed(4)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  </div>
)}

{altClickNode && (
  <div 
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
    onClick={() => setAltClickNode(null)}
  >
    <div 
      className="bg-white p-6 rounded-lg shadow-lg"
      onClick={e => e.stopPropagation()}
    >
      <h3 className="text-lg font-bold mb-4 text-black">
        Probability Table for {altClickNode.name}
      </h3>
      
      {(() => {
        const table = generateProbabilityTable(altClickNode);
        const parents = getNodeParents(altClickNode.id);
        const isParentNode = parents.length === 0;

        return (
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                {table.headers.map((header, i) => (
                  <th key={i} className="px-4 py-2 bg-gray-50 text-black">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
                 {table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {isParentNode ? (
                          <>
                            <td className="px-4 py-2 text-center text-black">{row[0] || ''}</td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="1"
                                value={inputValues[rowIndex] ?? row[1] ?? 0}
                                className="w-20 text-center border rounded p-1"
                                onChange={(e) => {
                                  const newValue = parseFloat(e.target.value);
                                  // Update local state immediately
                                  const newInputValues = [...inputValues];
                                  newInputValues[rowIndex] = e.target.value;
                                  setInputValues(newInputValues);
                                  
                                  // Update network state if valid
                                  if (!isNaN(newValue) && newValue >= 0 && newValue <= 1) {
                                    updateProbability(
                                      altClickNode.id,
                                      rowIndex,
                                      1,
                                      newValue
                                    );
                                  }
                                }}
                              />
                            </td>
                          </>                    ) : (
                        // Child node: row has parentValues and probabilities
                        <>
                          {row.parentValues.map((value, i) => (
                            <td key={i} className="px-4 py-2 text-center text-black">
                              {value}
                            </td>
                          ))}
                          {row.probabilities.map((prob, colIndex) => (
                            <td key={`prob-${colIndex}`} className="px-4 py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="1"
                                step="0.1"
                                value={prob}
                                className="w-20 text-center border rounded p-1"
                                onChange={(e) => {
                                  const newValue = parseFloat(e.target.value);
                                  if (!isNaN(newValue) && newValue >= 0 && newValue <= 1) {
                                    updateProbability(
                                      altClickNode.id,
                                      row.id,
                                      colIndex,
                                      newValue
                                    );
                                  }
                                }}
                              />
                            </td>
                          ))}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}

          <div className="flex justify-end mt-4">
            <button
              onClick={() => setAltClickNode(null)}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default BayesNetwork;
