import { useState, useRef, useEffect, useCallback, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, ClipboardCopy, Percent, DollarSign, Receipt, Divide } from 'lucide-react';

// --- Interface Definitions ---

interface Person {
  id: number;
  name: string;
}

interface Split {
  personId: number;
  ratio: number;
}

interface Item {
  id: number;
  name: string;
  cost: number;
  costExpression: string; // Used for the input field to show the expression (e.g., "4+2")
  splits: Split[];
}

type TaxTipType = 'percentage' | 'amount';

// --- Component ---

export default function BillSplitter() {
  // --- State Hooks ---
  const [persons, setPersons] = useState<Person[]>([
    { id: 1, name: 'Person 1' }
  ]);
  const [items, setItems] = useState<Item[]>([]);
  const [billName, setBillName] = useState<string>('');
  const [taxType, setTaxType] = useState<TaxTipType>('amount');
  const [taxValue, setTaxValue] = useState<string>('');
  const [tipType, setTipType] = useState<TaxTipType>('percentage');
  const [tipValue, setTipValue] = useState<string>('');
  const [focusedCostField, setFocusedCostField] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  // --- Ref Hooks ---
  const billNameInputRef = useRef<HTMLInputElement>(null);
  const personInputRef = useRef<HTMLInputElement>(null);
  const itemNameInputRef = useRef<HTMLInputElement>(null);

  // --- Utility Functions ---
  const showToast = useCallback((message: string): void => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  }, []);

  // --- Calculation Functions ---
  const calculateSubtotal = useCallback((): number => {
    return items.reduce((sum, item) => sum + (item.cost ?? '0'), 0);
  }, [items]);

  const calculateTaxAmount = useCallback((): number => {
    const subtotal = calculateSubtotal();
    const taxVal = parseFloat(taxValue) || 0;
    if (taxType === 'percentage') {
      return subtotal * (taxVal / 100);
    }
    return taxVal;
  }, [calculateSubtotal, taxType, taxValue]);

  const calculateTipAmount = useCallback((): number => {
    const subtotal = calculateSubtotal();
    const tipVal = parseFloat(tipValue) || 0;
    if (tipType === 'percentage') {
      return subtotal * (tipVal / 100);
    }
    return tipVal;
  }, [calculateSubtotal, tipType, tipValue]);

  const grandTotal = calculateSubtotal() + calculateTaxAmount() + calculateTipAmount();
  
  const calculatePersonSubtotal = useCallback((personId: number): number => {
    return items.reduce((sum, item) => {
      const totalRatio = item.splits.reduce((s, split) => s + split.ratio, 0);
      if (totalRatio === 0) return sum;
      
      const split = item.splits.find(s => s.personId === personId);
      if (!split) return sum;
      
      return sum + (item.cost * split.ratio / totalRatio);
    }, 0);
  }, [items]);

  const calculatePersonTotal = useCallback((personId: number): number => {
    const subtotal = calculateSubtotal();
    const personSubtotal = calculatePersonSubtotal(personId);
    
    if (subtotal === 0) return 0;
    
    const ratio = personSubtotal / subtotal;
    const tax = calculateTaxAmount() * ratio;
    const tip = calculateTipAmount() * ratio;
    
    return personSubtotal + tax + tip;
  }, [calculateSubtotal, calculatePersonSubtotal, calculateTaxAmount, calculateTipAmount]);
  
  const getPersonItems = useCallback((personId: number): { name: string, totalCost: number, ratio: number, totalRatio: number, amount: string }[] => {
    return items.filter(item => 
      item.splits.some(s => s.personId === personId)
    ).map(item => {
      const totalRatio = item.splits.reduce((s, split) => s + split.ratio, 0);
      const split = item.splits.find(s => s.personId === personId)!; // '!' asserts that split is not null/undefined
      const amount = item.cost * split.ratio / totalRatio;
      
      return {
        name: item.name,
        totalCost: item.cost,
        ratio: split.ratio,
        totalRatio: totalRatio,
        amount: amount.toFixed(2)
      };
    });
  }, [items]);

  // --- CRUD/Logic Functions ---

  const addPerson = useCallback((): void => {
    const newPerson: Person = { 
      id: Date.now(), 
      name: `Person ${persons.length + 1}` 
    };
    setPersons(p => [...p, newPerson]);
  }, [persons.length]);

  const updatePerson = useCallback((id: number, name: string): void => {
    setPersons(p => p.map(person => person.id === id ? { ...person, name } : person));
  }, []);

  const deletePerson = useCallback((id: number): void => {
    if (persons.length === 1) return;
    setPersons(p => p.filter(person => person.id !== id));
    setItems(i => i.map(item => ({
      ...item,
      splits: item.splits.filter(s => s.personId !== id)
    })));
  }, [persons.length]);

  const addItem = useCallback((): void => {
    const newItem: Item = {
      id: Date.now(),
      name: 'New Item',
      cost: 0,
      costExpression: '0',
      splits: []
    };
    setItems(i => [...i, newItem]);
  }, []);

  const updateItem = useCallback((id: number, field: keyof Item | 'costExpression', value: string): void => {
    if (field === 'costExpression') {
      setItems(i => i.map(item => 
        item.id === id ? { ...item, costExpression: value } : item
      ));
    } else if (field === 'name') {
      setItems(i => i.map(item => 
        item.id === id ? { ...item, name: value } : item
      ));
    }
  }, []);

  const evaluateCostExpression = useCallback((id: number, expression: string): void => {
    try {
      const cleanValue = expression.replace(/\s/g, '');
      const operators = /[\+\-\*\/]/;
      const validChars = /^[\d\.\+\-\*\/\(\)]+$/;
      
      let result: number | undefined = undefined;

      if (operators.test(cleanValue) && validChars.test(cleanValue)) {
        // Use Function constructor for calculation (safer than eval)
        result = Function('"use strict"; return (' + cleanValue + ')')();
      }
      
      if (result !== undefined && !isNaN(result) && isFinite(result)) {
        setItems(i => i.map(item => 
          item.id === id ? { ...item, cost: result!, costExpression: expression } : item
        ));
        return;
      }
      
      const numValue = parseFloat(expression);
      if (!isNaN(numValue)) {
        setItems(i => i.map(item => 
          item.id === id ? { ...item, cost: numValue, costExpression: expression } : item
        ));
      } else {
        // Fallback: If evaluation or float parsing fails, keep the original cost but update the expression
        setItems(i => i.map(item => 
          item.id === id ? { ...item, costExpression: expression } : item
        ));
      }
    } catch (e) {
      // Keep original cost and update expression to what was typed if evaluation fails
      setItems(i => i.map(item => 
        item.id === id ? { ...item, costExpression: expression } : item
      ));
    }
  }, []);

  const splitEvenly = useCallback((itemId: number): void => {
    setItems(i => i.map(item => {
      if (item.id !== itemId) return item;
      
      const splits: Split[] = persons.map(person => ({
        personId: person.id,
        ratio: 1
      }));
      
      return { ...item, splits };
    }));
  }, [persons]);

  const deleteItem = useCallback((id: number): void => {
    setItems(i => i.filter(item => item.id !== id));
  }, []);

  const updateSplit = useCallback((itemId: number, personId: number, ratioStr: string): void => {
    const ratio = parseFloat(ratioStr);

    setItems(i => i.map(item => {
      if (item.id !== itemId) return item;
      
      let splits: Split[] = item.splits.filter(s => s.personId !== personId);
      
      if (ratio > 0) {
        splits = [...splits, { personId, ratio }];
      }
      
      return { ...item, splits };
    }));
  }, []);

  const getSplitRatio = useCallback((itemId: number, personId: number): number => {
    const item = items.find(i => i.id === itemId);
    const split = item?.splits.find(s => s.personId === personId);
    return split?.ratio || 0;
  }, [items]);
  
  // --- Export Functions ---
  
  const exportPersonSummary = useCallback((personId: number): void => {
    const person = persons.find(p => p.id === personId);
    if (!person) return;
    
    const itemsList = getPersonItems(personId);
    const subtotal = calculatePersonSubtotal(personId);
    const total = calculatePersonTotal(personId);
    const subtotalTotal = calculateSubtotal();
    const ratio = subtotalTotal > 0 ? (subtotal / subtotalTotal) : 0;
    const tax = calculateTaxAmount() * ratio;
    const tip = calculateTipAmount() * ratio;
    
    let summary = billName ? `${billName}\n` : '';
    summary += `${person.name}\n`;
    summary += `Items (${itemsList.length}):\n`;
    itemsList.forEach(item => {
      summary += `  ${item.name} - $${item.totalCost.toFixed(2)} (${item.ratio}/${item.totalRatio} split): $${item.amount}\n`;
    });
    summary += `-------------------\n`;
    summary += `Subtotal: $${subtotal.toFixed(2)}\n`;
    summary += `Tax: $${tax.toFixed(2)}\n`;
    summary += `Tip: $${tip.toFixed(2)}\n`;
    summary += `Total: $${total.toFixed(2)}\n`;
    
    navigator.clipboard.writeText(summary);
    showToast(`${person.name}'s summary copied!`);
  }, [persons, billName, getPersonItems, calculatePersonSubtotal, calculatePersonTotal, calculateSubtotal, calculateTaxAmount, calculateTipAmount, showToast]);

  const exportFullBill = useCallback((): void => {
    let summary = billName ? `${billName.toUpperCase()}\n` : '';
    summary += `FULL BILL SUMMARY\n`;
    summary += `${'='.repeat(35)}\n\n`;
    
    summary += `ITEMS BREAKDOWN:\n`;
    items.forEach(item => {
      summary += `* ${item.name} - $${item.cost.toFixed(2)}\n`;
      item.splits.forEach(split => {
        const person = persons.find(p => p.id === split.personId);
        if (!person) return;
        const totalRatio = item.splits.reduce((s, sp) => s + sp.ratio, 0);
        const amount = totalRatio > 0 ? (item.cost * split.ratio / totalRatio) : 0;
        summary += `  -> ${person.name}: ${split.ratio}/${totalRatio} ratio = $${amount.toFixed(2)}\n`;
      });
      summary += `\n`;
    });
    
    summary += `${'='.repeat(35)}\n`;
    summary += `BREAKDOWN BY PERSON:\n\n`;
    
    persons.forEach(person => {
      const subtotal = calculatePersonSubtotal(person.id);
      const total = calculatePersonTotal(person.id);
      const subtotalTotal = calculateSubtotal();
      const ratio = subtotalTotal > 0 ? (subtotal / subtotalTotal) : 0;
      const tax = calculateTaxAmount() * ratio;
      const tip = calculateTipAmount() * ratio;
      
      summary += `${person.name}:\n`;
      summary += `  Subtotal: $${subtotal.toFixed(2)}\n`;
      summary += `  Tax: $${tax.toFixed(2)}\n`;
      summary += `  Tip: $${tip.toFixed(2)}\n`;
      summary += `  Total DUE: $${total.toFixed(2)}\n\n`;
    });
    
    summary += `${'='.repeat(35)}\n`;
    summary += `BILL TOTALS:\n`;
    summary += `Subtotal: $${calculateSubtotal().toFixed(2)}\n`;
    summary += `Tax: $${calculateTaxAmount().toFixed(2)}\n`;
    summary += `Tip: $${calculateTipAmount().toFixed(2)}\n`;
    summary += `GRAND TOTAL: $${grandTotal.toFixed(2)}\n`;
    summary += `${'='.repeat(35)}\n`;
    
    navigator.clipboard.writeText(summary);
    showToast('Full bill summary copied!');
  }, [items, persons, billName, calculatePersonSubtotal, calculatePersonTotal, calculateSubtotal, calculateTaxAmount, calculateTipAmount, grandTotal, showToast]);
  
  // --- Effects ---

  useEffect(() => {
    if (billNameInputRef.current) {
      billNameInputRef.current.focus();
      billNameInputRef.current.select();
    }
  }, []); // Initial focus on bill name

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
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
  }, [addPerson, addItem]); // Add/Item shortcuts

  useEffect(() => {
    if (persons.length > 1 && personInputRef.current) {
      personInputRef.current.focus();
      personInputRef.current.select();
    }
  }, [persons.length]); // Focus on new person

  useEffect(() => {
    if (items.length > 0 && itemNameInputRef.current) {
      itemNameInputRef.current.focus();
      itemNameInputRef.current.select();
    }
  }, [items.length]); // Focus on new item

  // Handler for split ratio input keyboard navigation
  const handleSplitKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'h', 'j', 'k', 'l'];
    if (navKeys.includes(e.key)) {
      e.preventDefault();
      const currentCell = e.currentTarget.closest('td');
      if (!currentCell) return;

      const currentRow = currentCell.closest('tr');
      if (!currentRow) return;

      // Get all split ratio inputs in the current row
      const allCells = Array.from(currentRow.querySelectorAll<HTMLInputElement>('input[type="number"]'));
      const currentCellIndex = allCells.indexOf(e.currentTarget);

      // Get all table body rows
      const tbody = currentRow.parentElement;
      if (!tbody) return;
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const currentRowIndex = allRows.indexOf(currentRow);
      
      if ((e.key === 'ArrowRight' || e.key === 'l') && currentCellIndex < allCells.length - 1) {
        allCells[currentCellIndex + 1].focus();
      } else if ((e.key === 'ArrowLeft' || e.key === 'h') && currentCellIndex > 0) {
        allCells[currentCellIndex - 1].focus();
      } else if ((e.key === 'ArrowDown' || e.key === 'j') && currentRowIndex < allRows.length - 1) {
        const nextRow = allRows[currentRowIndex + 1];
        const nextCells = Array.from(nextRow.querySelectorAll<HTMLInputElement>('input[type="number"]'));
        if (nextCells[currentCellIndex]) nextCells[currentCellIndex].focus();
      } else if ((e.key === 'ArrowUp' || e.key === 'k') && currentRowIndex > 0) {
        const prevRow = allRows[currentRowIndex - 1];
        const prevCells = Array.from(prevRow.querySelectorAll<HTMLInputElement>('input[type="number"]'));
        if (prevCells[currentCellIndex]) prevCells[currentCellIndex].focus();
      }
    }
  };


  // --- Render ---

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
          <h1 className="text-xl font-bold text-gray-100 mr-32">Bill Splitter</h1>
          <input
            ref={billNameInputRef}
            type="text"
            value={billName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setBillName(e.target.value)}
            placeholder="[Name]"
            className="flex-1 max-w-md px-3 py-2 border border-gray-600 bg-gray-800 text-gray-100 rounded text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-3 text-left text-gray-100 font-semibold bg-gray-900 min-w-[200px]">
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
                <th className="p-3 text-left text-gray-100 font-semibold bg-gray-900 w-24 min-w-[120px]">Cost</th>
                {persons.map((person, index) => (
                  <th key={person.id} className="p-3 text-center bg-gray-900 border-l border-gray-700 min-w-[100px]">
                    <div className="flex flex-col gap-1">
                      <input
                        ref={index === persons.length - 1 ? personInputRef : null}
                        type="text"
                        value={person.name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => updatePerson(person.id, e.target.value)}
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
                <th className="p-3 text-center bg-gray-900 border-l border-gray-700 min-w-[80px]">
                  <span className='text-gray-100 mr-1'>Person</span>
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
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateItem(item.id, 'name', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-600 bg-gray-900 text-gray-100 rounded text-sm focus:border-green-500 focus:outline-none"
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={focusedCostField === item.id ? (item.costExpression || item.cost.toString()) : item.cost.toFixed(2)}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => updateItem(item.id, 'costExpression', e.target.value)}
                        onFocus={() => setFocusedCostField(item.id)}
                        onBlur={(e: FocusEvent<HTMLInputElement>) => {
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
                        <Divide size={16}/>
                      </button>
                    </div>
                  </td>
                  {persons.map(person => (
                    <td key={person.id} className="p-2 text-center border-l border-gray-700">
                      <input
                        type="number"
                        value={getSplitRatio(item.id, person.id) || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => updateSplit(item.id, person.id, e.target.value)}
                        onKeyDown={handleSplitKeyDown}
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
            <div className="space-y-3">
              <div className='mb-4'>
                <label className="block text-md font-medium mb-2 text-gray-300">Tax</label>
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
                    </button>
                  </div>
                  <input
                    type="number"
                    value={taxValue}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setTaxValue(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
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
                <label className="block text-md font-medium mb-2 text-gray-300">Tip</label>
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
                    </button>
                  </div>
                  <input
                    type="number"
                    value={tipValue}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setTipValue(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
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
            <div className='flex justify-between items-start'>
              <h2 className="text-lg font-semibold text-gray-100 mb-3">Grand Total</h2>
                <button
                  onClick={exportFullBill}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 text-sm font-semibold"
                >
                <ClipboardCopy size={16} />
              </button>
            </div>
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
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg p-4 mt-4 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-3">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {persons.map(person => {
              const subtotal = calculatePersonSubtotal(person.id);
              const total = calculatePersonTotal(person.id);
              const subtotalTotal = calculateSubtotal();
              const ratio = subtotalTotal > 0 ? (subtotal / subtotalTotal) : 0;
              
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