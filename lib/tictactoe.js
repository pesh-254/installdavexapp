class TicTacToe {
    constructor(playerX = 'X', playerO = 'O') {
        this.playerX = playerX;
        this.playerO = playerO;
        this._isOTurn = false;   // clearer naming
        this._xMoves = 0;        // bitboard for X
        this._oMoves = 0;        // bitboard for O
        this.turns = 0;
    }

    // Combined board state
    get board() {
        return this._xMoves | this._oMoves;
    }

    // Whose turn is it?
    get currentTurn() {
        return this._isOTurn ? this.playerO : this.playerX;
    }

    // Check winner
    get winner() {
        const winningPatterns = [
            0b111000000, // Top row
            0b000111000, // Middle row
            0b000000111, // Bottom row
            0b100100100, // Left column
            0b010010010, // Middle column
            0b001001001, // Right column
            0b100010001, // Diagonal TL-BR
            0b001010100  // Diagonal TR-BL
        ];

        for (let pattern of winningPatterns) {
            if ((this._xMoves & pattern) === pattern) return this.playerX;
            if ((this._oMoves & pattern) === pattern) return this.playerO;
        }

        return null;
    }

    // Check if game ended in a draw
    get isDraw() {
        return this.turns === 9 && !this.winner;
    }

    // Make a move
    turn(pos) {
        if (this.winner || this.isDraw) return -1; // game already over
        if (pos < 0 || pos > 8) return -2;         // invalid position
        if (this.board & (1 << pos)) return 0;     // already taken

        const move = 1 << pos;
        if (this._isOTurn) {
            this._oMoves |= move;
        } else {
            this._xMoves |= move;
        }

        this._isOTurn = !this._isOTurn;
        this.turns++;
        return 1; // successful move
    }

    // Render board as 3x3 grid
    render() {
        const cells = [...Array(9)].map((_, i) => {
            const bit = 1 << i;
            if (this._xMoves & bit) return this.playerX;
            if (this._oMoves & bit) return this.playerO;
            return i + 1;
        });

        return `
${cells.slice(0, 3).join(' | ')}
---------
${cells.slice(3, 6).join(' | ')}
---------
${cells.slice(6, 9).join(' | ')}
        `;
    }
}

module.exports = TicTacToe;
