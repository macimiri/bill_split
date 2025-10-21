import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BillSplitter from './bill_split.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BillSplitter />
  </StrictMode>,
)
