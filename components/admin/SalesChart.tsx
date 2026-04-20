'use client'

import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface SalesDataPoint {
  key: string
  label: string
  value: number
  orders: number
}

interface SalesChartProps {
  data: SalesDataPoint[]
}

const formatBRL = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function SalesChart({ data }: SalesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">
        Sem dados de vendas para o período
      </div>
    )
  }

  return (
    <div className="w-full h-full min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
            tickFormatter={(value) => `R$ ${value}`}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as SalesDataPoint
                return (
                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-700">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-lg font-black">{formatBRL(data.value)}</p>
                    <p className="text-xs text-slate-300 mt-1">{data.orders} pedido{data.orders !== 1 ? 's' : ''}</p>
                  </div>
                )
              }
              return null
            }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#4f46e5" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorValue)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
