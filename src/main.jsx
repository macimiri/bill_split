import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import BillSplitter from './bill_split.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BillSplitter />
  </StrictMode>,
)
