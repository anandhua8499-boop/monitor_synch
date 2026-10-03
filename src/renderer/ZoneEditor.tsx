import { useMemo } from 'react'

export interface Zone {
  id: number
  x: number
  y: number
  width: number
  height: number
  ledIndex: number
}

export interface ZoneColor {
  zoneId: number
  r: number
  g: number
  b: number
}

interface ZoneEditorProps {
  zones: Zone[]
  colors?: ZoneColor[]
  onZonesChange: (zones: Zone[]) => void
}

export default function ZoneEditor({
  zones,
  colors = [],
  onZonesChange,
}: ZoneEditorProps) {
  const selectedCount = useMemo(
    () => zones.length,
    [zones],
  )

  const getZoneColor = (zoneId: number) => {
    const color = colors.find(
      (item) => item.zoneId === zoneId,
    )

    if (!color) {
      return 'rgb(20, 20, 20)'
    }

    return `rgb(${color.r}, ${color.g}, ${color.b})`
  }

  const updateZone = (
    id: number,
    changes: Partial<Zone>,
  ) => {
    const updated = zones.map((zone) =>
      zone.id === id
        ? {
            ...zone,
            ...changes,
          }
        : zone,
    )

    onZonesChange(updated)
  }

  const createZones = () => {
    const count = 36

    const columns = 12
    const rows = 3

    const width = 100 / columns
    const height = 100 / rows

    const newZones: Zone[] = []

    for (let i = 0; i < count; i++) {
      const column = i % columns
      const row = Math.floor(i / columns)

      newZones.push({
        id: i,
        x: column * width,
        y: row * height,
        width,
        height,
        ledIndex: i,
      })
    }

    onZonesChange(newZones)
  }

  return (
    <div className="zone-editor">
      <div className="zone-editor-header">
        <div>
          <h2>Zone Editor</h2>

          <span>
            {selectedCount} zones · 1 zone = 1 LED
          </span>
        </div>

        <button
          type="button"
          onClick={createZones}
        >
          Create 36 Zones
        </button>
      </div>

      {/* MONITOR / LIVE ZONE PREVIEW */}

      <div className="zone-editor-canvas">
        {zones.map((zone) => {
          const liveColor =
            getZoneColor(zone.id)

          return (
            <div
              key={zone.id}
              className="zone-box"
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`,
                backgroundColor: liveColor,
              }}
            >
              <strong>
                Z{zone.id + 1}
              </strong>

              <small>
                LED {zone.ledIndex}
              </small>
            </div>
          )
        })}
      </div>

      {/* ZONE CONFIGURATION */}

      <div className="zone-list">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="zone-row"
          >
            <strong>
              Zone {zone.id + 1}
            </strong>

            <label>
              X

              <input
                type="number"
                value={zone.x}
                step="0.1"
                onChange={(e) =>
                  updateZone(
                    zone.id,
                    {
                      x: Number(
                        e.target.value,
                      ),
                    },
                  )
                }
              />
            </label>

            <label>
              Y

              <input
                type="number"
                value={zone.y}
                step="0.1"
                onChange={(e) =>
                  updateZone(
                    zone.id,
                    {
                      y: Number(
                        e.target.value,
                      ),
                    },
                  )
                }
              />
            </label>

            <label>
              Width

              <input
                type="number"
                value={zone.width}
                step="0.1"
                min="0"
                max="100"
                onChange={(e) =>
                  updateZone(
                    zone.id,
                    {
                      width: Number(
                        e.target.value,
                      ),
                    },
                  )
                }
              />
            </label>

            <label>
              Height

              <input
                type="number"
                value={zone.height}
                step="0.1"
                min="0"
                max="100"
                onChange={(e) =>
                  updateZone(
                    zone.id,
                    {
                      height: Number(
                        e.target.value,
                      ),
                    },
                  )
                }
              />
            </label>

            <label>
              LED

              <input
                type="number"
                min="0"
                max="35"
                value={zone.ledIndex}
                onChange={(e) =>
                  updateZone(
                    zone.id,
                    {
                      ledIndex: Number(
                        e.target.value,
                      ),
                    },
                  )
                }
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}