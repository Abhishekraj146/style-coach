// App ka entry: neeche 5 tabs, jo tab chuna hai wahi screen dikhti hai.
import { useState } from 'react'
import Wardrobe from './screens/Wardrobe'
import Outfits from './screens/Outfits'
import Camera from './screens/Camera'
import Photos from './screens/Photos'
import Me from './screens/Me'

const TABS = [
  { id: 'wardrobe', label: 'Wardrobe', icon: '👕', Screen: Wardrobe },
  { id: 'outfits', label: 'Outfits', icon: '✨', Screen: Outfits },
  { id: 'camera', label: 'Camera', icon: '📷', Screen: Camera },
  { id: 'photos', label: 'Photos', icon: '🖼️', Screen: Photos },
  { id: 'me', label: 'Me', icon: '👤', Screen: Me },
]

export default function App() {
  const [tab, setTab] = useState('wardrobe')
  const { Screen } = TABS.find((t) => t.id === tab)
  return (
    <div className={'app' + (tab === 'camera' ? ' app--camera' : '')}>
      <main className="screen">
        {/* key={tab}: tab badalne pe screen fresh load hoti hai (latest data padhti hai) */}
        <Screen key={tab} goTo={setTab} />
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="tabicon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
