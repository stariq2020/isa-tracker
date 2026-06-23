'use client'
import dynamic from 'next/dynamic'
const ISATracker = dynamic(() => import('./components/ISATracker'), { ssr: false })
export default function Home() { return <ISATracker /> }
