'use client';

interface Seat {
  id: string;
  seatNumber: string;
  row: number;
  col: number;
  category: string;
  price: number;
  status: string;
}

interface SeatMapProps {
  rows: Seat[][];
  selectedSeats: string[];
  heldSeats: string[];
  onToggleSeat: (seatId: string) => void;
  readOnly?: boolean;
}

const categoryColors: Record<string, string> = {
  PREMIUM: 'bg-purple-500 hover:bg-purple-400',
  STANDARD: 'bg-blue-500 hover:bg-blue-400',
  ECONOMY: 'bg-green-500 hover:bg-green-400',
};

export default function SeatMap({ rows, selectedSeats, heldSeats, onToggleSeat, readOnly }: SeatMapProps) {
  const getSeatStyle = (seat: Seat) => {
    // Check heldSeats first - this reflects current user's held seats
    const isHeldByMe = heldSeats.includes(seat.id);
    const isSelected = selectedSeats.includes(seat.id);

    if (seat.status === 'BOOKED') return 'bg-gray-700 cursor-not-allowed opacity-50';
    if (seat.status === 'HELD' && !isHeldByMe) return 'bg-yellow-500 cursor-not-allowed';
    if (isSelected) return 'bg-green-400 ring-2 ring-green-600 scale-110';
    if (isHeldByMe) return 'bg-yellow-400 ring-2 ring-yellow-600'; // User's held seats
    if (readOnly) return 'bg-gray-300';
    return categoryColors[seat.category] || 'bg-blue-500';
  };

  const rowLabel = (rowNum: number) => String.fromCharCode(64 + rowNum);

  return (
    <div className="space-y-2">
      {/* Screen */}
      <div className="text-center mb-6">
        <div className="h-2 bg-gray-300 rounded-full w-3/4 mx-auto mb-1"></div>
        <span className="text-xs text-gray-500">SCREEN</span>
      </div>

      {/* Seat Grid */}
      {rows.map((seatRow) => (
        <div key={seatRow[0]?.row || 0} className="flex items-center justify-center gap-1">
          <span className="w-6 text-xs text-gray-500 text-right mr-2">
            {rowLabel(seatRow[0]?.row || 0)}
          </span>
          {seatRow.map((seat) => (
            <button
              key={seat.id}
              onClick={() => !readOnly && onToggleSeat(seat.id)}
              disabled={readOnly || seat.status === 'BOOKED' || (seat.status === 'HELD' && !heldSeats.includes(seat.id))}
              className={`w-8 h-8 rounded text-xs text-white font-medium transition-all ${getSeatStyle(seat)}`}
              title={`${seat.seatNumber} - ₹${Number(seat.price).toLocaleString('en-IN')}`}
            >
              {seat.col}
            </button>
          ))}
        </div>
      ))}

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-6 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-purple-500"></div>
          <span>Premium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-blue-500"></div>
          <span>Standard</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span>Economy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-gray-700 opacity-50"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-yellow-500"></div>
          <span>Held</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-400 ring-2 ring-green-600"></div>
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
}
