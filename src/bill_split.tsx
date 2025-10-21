import React, { useState, useRef, useEffect } from 'react';
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, ClipboardCopy, Percent, DollarSign, Users } from 'lucide-react';

export default function BillSplitter() {
  const [persons, setPersons] = useState([
    { id: 1, name: 'Person 1' }
  ]);
  const [items, setItems] = useState([]);
  const [billName, setBillName] = useState('');
  const [taxType, setTaxType] = useState('amount');
  const [taxValue, setTaxValue] = useState('');
  const [tipType, setTipType] = useState('percentage');
  const [tipValue, setTipValue] = useState('');
  const [focusedCostField, setFocusedCostField] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const billNameInputRef = useRef(null);
  const personInputRef = useRef(null);
  const itemNameInputRef = useRef(null);

  useEffect(() => {
    if (billNameInputRef.current) {
      billNameInputRef.current.focus();
      billNameInputRef.current.select();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey && e.key === 'p') {
        e.preventDefault();
        addPerson();
      } else if (e.metaKey && e.key === 'i') {
        e.preventDefault();
        addItem();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [persons, items]);

  useEffect(() => {
    if (persons.length === 1 && personInputRef.current) {
      // Don't auto-focus person field on initial load
      return;
    }
    if (personInputRef.current) {
      personInputRef.current.focus();
      personInputRef.current.select();
    }
  }, [persons.length]);

  useEffect(() => {
    if (itemNameInputRef.current) {
      itemNameInputRef.current.focus();
      itemNameInputRef.current.select();
    }
  }, [items.length]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const addPerson = () => {
    const newPerson = { 
      id: Date.now(), 
      name: `Person ${persons.length + 1}` 
    };
    setPersons([...persons, newPerson]);
  };

  const updatePerson = (id, name) => {
    setPersons(persons.map(p => p.id === id ? { ...p, name } : p));
  };

  const deletePerson = (id) => {
    if (persons.length === 1) return;
    setPersons(persons.filter(p => p.id !== id));
    setItems(items.map(item => ({
      ...item,
      splits: item.splits.filter(s => s.personId !== id)
    })));
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      name: 'New Item',
      cost: 0,
      costExpression: '0',
      splits: []
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id, field, value) => {
    if (field === 'cost') {
      setItems(items.map(item => 
        item.id === id ? { ...item, costExpression: value, cost: item.cost } : item
      ));
    } else {
      setItems(items.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      ));
    }
  };

  const evaluateCostExpression = (id, expression) => {
    try {
      const cleanValue = expression.replace(/\s/g, '');
      const operators = /[\+\-\*\/]/;
      const validChars = /^[\d\.\+\-\*\/\(\)]+$/;
      
      if (operators.test(cleanValue)) {
        if (validChars.test(cleanValue)) {
          const result = Function('"use strict"; return (' + cleanValue + ')')();
          if (!isNaN(result) && isFinite(result)) {
            setItems(items.map(item => 
              item.id === id ? { ...item, cost: result, costExpression: expression } : item
            ));
            return;
          }
        }
      }
      
      const numValue = parseFloat(expression);
      if (!isNaN(numValue)) {
        setItems(items.map(item => 
          item.id === id ? { ...item, cost: numValue, costExpression: expression } : item
        ));
      }
    } catch (e) {
      // Keep original value if evaluation fails
    }
  };

  const splitEvenly = (itemId) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      
      const splits = persons.map(person => ({
        personId: person.id,
        ratio: 1
      }));
      
      return { ...item, splits };
    }));
  };

  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateSplit = (itemId, personId, ratio) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      
      const splits = item.splits.filter(s => s.personId !== personId);
      if (ratio > 0) {
        splits.push({ personId, ratio: parseFloat(ratio) });
      }
      
      return { ...item, splits };
    }));
  };

  const getSplitRatio = (itemId, personId) => {
    const item = items.find(i => i.id === itemId);
    const split = item?.splits.find(s => s.personId === personId);
    return split?.ratio || 0;
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0);
  };

  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal();
    const taxVal = parseFloat(taxValue) || 0;
    if (taxType === 'percentage') {
      return subtotal * (taxVal / 100);
    }
    return taxVal;
  };

  const calculateTipAmount = () => {
    const subtotal = calculateSubtotal();
    const tipVal = parseFloat(tipValue) || 0;
    if (tipType === 'percentage') {
      return subtotal * (tipVal / 100);
    }
    return tipVal;
  };

  const calculatePersonSubtotal = (personId) => {
    return items.reduce((sum, item) => {
      const totalRatio = item.splits.reduce((s, split) => s + split.ratio, 0);
      if (totalRatio === 0) return sum;
      
      const split = item.splits.find(s => s.personId === personId);
      if (!split) return sum;
      
      return sum + (item.cost * split.ratio / totalRatio);
    }, 0);
  };

  const calculatePersonTotal = (personId) => {
    const subtotal = calculateSubtotal();
    const personSubtotal = calculatePersonSubtotal(personId);
    
    if (subtotal === 0) return 0;
    
    const ratio = personSubtotal / subtotal;
    const tax = calculateTaxAmount() * ratio;
    const tip = calculateTipAmount() * ratio;
    
    return personSubtotal + tax + tip;
  };

  const getPersonItems = (personId) => {
    return items.filter(item => 
      item.splits.some(s => s.personId === personId)
    ).map(item => {
      const totalRatio = item.splits.reduce((s, split) => s + split.ratio, 0);
      const split = item.splits.find(s => s.personId === personId);
      const amount = item.cost * split.ratio / totalRatio;
      
      return {
        name: item.name,
        totalCost: item.cost,
        ratio: split.ratio,
        totalRatio: totalRatio,
        amount: amount.toFixed(2)
      };
    });
  };

  const exportPersonSummary = (personId) => {
    const person = persons.find(p => p.id === personId);
    const itemsList = getPersonItems(personId);
    const subtotal = calculatePersonSubtotal(personId);
    const total = calculatePersonTotal(personId);
    const subtotalTotal = calculateSubtotal();
    const ratio = subtotalTotal > 0 ? (subtotal / subtotalTotal) : 0;
    const tax = calculateTaxAmount() * ratio;
    const tip = calculateTipAmount() * ratio;
    
    let summary = billName ? `${billName}\n` : '';
    summary += `Bill Summary for ${person.name}\n`;
    summary += `${'='.repeat(60)}\n\n`;
    summary += `Items:\n`;
    itemsList.forEach(item => {
      summary += `  ${item.name} - ${item.totalCost.toFixed(2)} (${item.ratio}/${item.totalRatio}): ${item.amount}\n`;
    });
    summary += `\nSubtotal: ${subtotal.toFixed(2)}\n`;
    summary += `Tax: ${tax.toFixed(2)}\n`;
    summary += `Tip: ${tip.toFixed(2)}\n`;
    summary += `${'='.repeat(60)}\n`;
    summary += `Total: ${total.toFixed(2)}\n`;
    
    navigator.clipboard.writeText(summary);
    showToast(`${person.name}'s summary copied!`);
  };

  const exportFullBill = () => {
    let summary = billName ? `${billName.toUpperCase()}\n` : '';
    summary += `FULL BILL SUMMARY\n`;
    summary += `${'='.repeat(60)}\n\n`;
    
    summary += `ITEMS:\n`;
    items.forEach(item => {
      summary += `${item.name} - ${item.cost.toFixed(2)}\n`;
      item.splits.forEach(split => {
        const person = persons.find(p => p.id === split.personId);
        const totalRatio = item.splits.reduce((s, sp) => s + sp.ratio, 0);
        const amount = item.cost * split.ratio / totalRatio;
        summary += `  ${person.name}: ${split.ratio}/${totalRatio} = ${amount.toFixed(2)}\n`;
      });
      summary += `\n`;
    });
    
    summary += `${'='.repeat(60)}\n`;
    summary += `BREAKDOWN BY PERSON:\n\n`;
    
    persons.forEach(person => {
      const subtotal = calculatePersonSubtotal(person.id);
      const total = calculatePersonTotal(person.id);
      const subtotalTotal = calculateSubtotal();
      const ratio = subtotalTotal > 0 ? (subtotal / subtotalTotal) : 0;
      const tax = calculateTaxAmount() * ratio;
      const tip = calculateTipAmount() * ratio;
      
      summary += `${person.name}:\n`;
      summary += `  Subtotal: ${subtotal.toFixed(2)}\n`;
      summary += `  Tax: ${tax.toFixed(2)}\n`;
      summary += `  Tip: ${tip.toFixed(2)}\n`;
      summary += `  Total: ${total.toFixed(2)}\n\n`;
    });
    
    summary += `${'='.repeat(60)}\n`;
    summary += `BILL TOTALS:\n`;
    summary += `Subtotal: ${calculateSubtotal().toFixed(2)}\n`;
    summary += `Tax: ${calculateTaxAmount().toFixed(2)}\n`;
    summary += `Tip: ${calculateTipAmount().toFixed(2)}\n`;
    summary += `${'='.repeat(60)}\n`;
    summary += `GRAND TOTAL: ${grandTotal.toFixed(2)}\n`;
    
    navigator.clipboard.writeText(summary);
    showToast('Full bill summary copied!');
  };

  const grandTotal = calculateSubtotal() + calculateTaxAmount() + calculateTipAmount();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-3">
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          {toastMessage}
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Receipt className='stroke-indigo-600'/>
          <h1 className="text-xl font-bold text-gray-100">Bill Splitter</h1>
          <input
            ref={billNameInputRef}
            type="text"
            value={billName}
            onChange={(e) => setBillName(e.target.value)}
            placeholder="[Name]"
            className="flex-1 max-w-md px-3 py-2 border border-gray-600 bg-gray-800 text-gray-100 rounded text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-3 text-left text-gray-100 font-semibold bg-gray-900">
                  <div className="flex items-center gap-2">
                    <span>Item</span>
                    <button
                      onClick={addItem}
                      className="bg-green-600 text-white p-1 rounded hover:bg-green-700"
                      title="Cmd+I"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </th>
                <th className="p-3 text-left text-gray-100 font-semibold bg-gray-900 w-24">Cost</th>
                {persons.map((person, index) => (
                  <th key={person.id} className="p-3 text-center bg-gray-900 border-l border-gray-700">
                    <div className="flex flex-col gap-1">
                      <input
                        ref={index === persons.length - 1 ? personInputRef : null}
                        type="text"
                        value={person.name}
                        onChange={(e) => updatePerson(person.id, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-600 bg-gray-800 text-gray-100 rounded text-sm text-center focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => deletePerson(person.id)}
                        disabled={persons.length === 1}
                        className="text-red-400 hover:text-red-300 disabled:text-gray-600 self-center p-1 rounded hover:bg-red-900/30 disabled:hover:bg-transparent transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="p-3 text-center bg-gray-900 border-l border-gray-700">
                  <button
                    onClick={addPerson}
                    className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700"
                    title="Cmd+P"
                  >
                    <Plus size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, itemIndex) => (
                <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="p-2">
                    <input
                      ref={itemIndex === items.length - 1 ? itemNameInputRef : null}
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-600 bg-gray-900 text-gray-100 rounded text-sm focus:border-green-500 focus:outline-none"
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={focusedCostField === item.id ? (item.costExpression || item.cost) : item.cost}
                        onChange={(e) => updateItem(item.id, 'cost', e.target.value)}
                        onFocus={() => setFocusedCostField(item.id)}
                        onBlur={(e) => {
                          setFocusedCostField(null);
                          evaluateCostExpression(item.id, e.target.value);
                        }}
                        className="flex-1 px-2 py-1 border border-gray-600 bg-gray-900 text-gray-100 rounded text-sm focus:border-green-500 focus:outline-none"
                        placeholder="e.g. 4+2"
                      />
                      <button
                        onClick={() => splitEvenly(item.id)}
                        className="px-2 py-1 border border-gray-600 bg-gray-900 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded transition-colors"
                        title="Split evenly among all people"
                      >
                        <Users size={16} />
                      </button>
                    </div>
                  </td>
                  {persons.map(person => (
                    <td key={person.id} className="p-2 text-center border-l border-gray-700">
                      <input
                        type="number"
                        value={getSplitRatio(item.id, person.id) || ''}
                        onChange={(e) => updateSplit(item.id, person.id, e.target.value)}
                        onKeyDown={(e) => {
                          const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'h', 'j', 'k', 'l'];
                          if (navKeys.includes(e.key)) {
                            e.preventDefault();
                            const currentCell = e.target.closest('td');
                            const currentRow = currentCell.closest('tr');
                            const allCells = Array.from(currentRow.querySelectorAll('input[type="number"]'));
                            const allRows = Array.from(currentRow.parentElement.querySelectorAll('tr'));
                            const currentCellIndex = allCells.indexOf(e.target);
                            const currentRowIndex = allRows.indexOf(currentRow);
                            
                            if ((e.key === 'ArrowRight' || e.key === 'l') && currentCellIndex < allCells.length - 1) {
                              allCells[currentCellIndex + 1].focus();
                            } else if ((e.key === 'ArrowLeft' || e.key === 'h') && currentCellIndex > 0) {
                              allCells[currentCellIndex - 1].focus();
                            } else if ((e.key === 'ArrowDown' || e.key === 'j') && currentRowIndex < allRows.length - 1) {
                              const nextRow = allRows[currentRowIndex + 1];
                              const nextCells = Array.from(nextRow.querySelectorAll('input[type="number"]'));
                              if (nextCells[currentCellIndex]) nextCells[currentCellIndex].focus();
                            } else if ((e.key === 'ArrowUp' || e.key === 'k') && currentRowIndex > 0) {
                              const prevRow = allRows[currentRowIndex - 1];
                              const prevCells = Array.from(prevRow.querySelectorAll('input[type="number"]'));
                              if (prevCells[currentCellIndex]) prevCells[currentCellIndex].focus();
                            }
                          }
                        }}
                        className="w-16 px-2 py-1 border border-gray-600 bg-gray-900 text-gray-100 rounded text-sm text-center focus:border-blue-500 focus:outline-none mx-auto"
                        step="0.1"
                        min="0"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-center border-l border-gray-700">
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Tax + Tip box */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700">
            <h2 className="text-lg font-semibold text-gray-100 mb-3">Tax & Tip</h2>
            <div className="space-y-3">
              <div className='mb-4'>
                <label className="block text-sm font-medium mb-2 text-gray-300">Tax</label>
                <div className="flex gap-2">
                  <div className="flex border border-gray-600 rounded overflow-hidden">
                    <button
                      onClick={() => setTaxType('percentage')}
                      className={`px-3 py-2 flex items-center gap-1 transition-colors ${
                        taxType === 'percentage' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
                      }`}
                      title="Percentage"
                    >
                      <Percent size={16} />
                      <span className="text-xs">%</span>
                    </button>
                    <button
                      onClick={() => setTaxType('amount')}
                      className={`px-3 py-2 flex items-center gap-1 transition-colors ${
                        taxType === 'amount' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
                      }`}
                      title="Dollar amount"
                    >
                      <DollarSign size={16} />
                      <span className="text-xs">$</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    value={taxValue}
                    onChange={(e) => setTaxValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.preventDefault();
                        setTaxType(taxType === 'percentage' ? 'amount' : 'percentage');
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-600 bg-gray-900 text-gray-100 rounded text-sm focus:border-blue-500 focus:outline-none"
                    step="0.01"
                    placeholder={taxType === 'percentage' ? '0.00%' : '$0.00'}
                  />
                </div>
              </div>
              <Separator className='bg-gray-600'/>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Tip</label>
                <div className="flex gap-2">
                  <div className="flex border border-gray-600 rounded overflow-hidden">
                    <button
                      onClick={() => setTipType('percentage')}
                      className={`px-3 py-2 flex items-center gap-1 transition-colors ${
                        tipType === 'percentage' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
                      }`}
                      title="Percentage"
                    >
                      <Percent size={16} />
                      <span className="text-xs">%</span>
                    </button>
                    <button
                      onClick={() => setTipType('amount')}
                      className={`px-3 py-2 flex items-center gap-1 transition-colors ${
                        tipType === 'amount' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
                      }`}
                      title="Dollar amount"
                    >
                      <DollarSign size={16} />
                      <span className="text-xs">$</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    value={tipValue}
                    onChange={(e) => setTipValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.preventDefault();
                        setTipType(tipType === 'percentage' ? 'amount' : 'percentage');
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-600 bg-gray-900 text-gray-100 rounded text-sm focus:border-blue-500 focus:outline-none"
                    step="0.01"
                    placeholder={tipType === 'percentage' ? '0.00%' : '$0.00'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Grand total box */}
          <div className="p-4 bg-gradient-to-r from-green-900 to-emerald-900 rounded-lg shadow-lg border-2 border-green-500">
            <h2 className="text-lg font-semibold text-gray-100 mb-3">Grand Total</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-base text-gray-100">
                <span className="font-medium">Subtotal:</span>
                <span className="font-semibold">${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-300">
                <span>Tax:</span>
                <span className="font-medium">${calculateTaxAmount().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-300">
                <span>Tip:</span>
                <span className="font-medium">${calculateTipAmount().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-2xl font-bold pt-2 border-t-2 border-green-500">
                <span className="text-gray-100">Total:</span>
                <span className="text-green-400">${grandTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={exportFullBill}
                className="mt-3 w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <ClipboardCopy size={16} /> Copy Full Bill
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg p-4 mt-4 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-3">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {persons.map(person => {
              const subtotal = calculatePersonSubtotal(person.id);
              const total = calculatePersonTotal(person.id);
              const ratio = calculateSubtotal() > 0 ? (subtotal / calculateSubtotal()) : 0;
              
              return (
                <div key={person.id} className="p-3 bg-gradient-to-br from-gray-700 to-gray-600 rounded-lg border border-indigo-500">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-semibold text-base text-gray-100">{person.name}</h3>
                    <button
                      onClick={() => exportPersonSummary(person.id)}
                      className="text-indigo-400 hover:text-indigo-300"
                      title="Copy summary"
                    >
                      <ClipboardCopy size={16} />
                    </button>
                  </div>
                  <div className="space-y-0.5 text-xs">
                    <div className="flex justify-between text-gray-300">
                      <span>Subtotal:</span>
                      <span className="font-medium">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Ratio:</span>
                      <span>{(ratio * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Tax:</span>
                      <span>${(calculateTaxAmount() * ratio).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Tip:</span>
                      <span>${(calculateTipAmount() * ratio).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-1.5 border-t border-gray-500">
                      <span className="text-gray-100">Total:</span>
                      <span className="text-indigo-400">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}