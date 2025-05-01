"use client"
import { useState, useEffect, useCallback } from 'react';
import { FaBackspace, FaCheck, FaRedo } from 'react-icons/fa';

import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import Link from 'next/link';

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

// Helper function to get today's date key (YYYY-MM-DD)
const getTodayKey = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function WordleGame() {
  const [targetWord, setTargetWord] = useState('');
  const [wordList, setWordList] = useState([]);
  const [guesses, setGuesses] = useState(Array(MAX_ATTEMPTS).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [currentRow, setCurrentRow] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [winAnimation, setWinAnimation] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load word list and today's word
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // 1. Load word list
        const response = await fetch(
          'https://gist.githubusercontent.com/dracos/dd0668f281e685bad51479e5acaadb93/raw/6bfa15d263d6d5b63840a8e5b64e04b382fdb079/valid-wordle-words.txt'
        );
        const text = await response.text();
        const words = text.split('\n').filter(word => word.length === WORD_LENGTH);
        setWordList(words);
        
        // 2. Check Firebase for today's word
        const todayKey = getTodayKey();
        const wordDocRef = doc(db, 'dailyWords', todayKey);
        const docSnap = await getDoc(wordDocRef);
        
        if (docSnap.exists()) {
          // Use existing word
          setTargetWord(docSnap.data().word.toUpperCase());
        } else {
          // Select new word and save to Firebase
          const randomWord = words[Math.floor(Math.random() * words.length)].toUpperCase();
          await setDoc(wordDocRef, { 
            word: randomWord,
            date: todayKey,
            timestamp: new Date()
          });
          setTargetWord(randomWord);
        }
      } catch (error) {
        console.error('Error initializing game:', error);
        // Fallback if Firebase fails
        const fallbackWords = ['REACT', 'NEXTJS', 'HOOKS', 'GAMES', 'CODER'];
        setWordList(fallbackWords);
        setTargetWord(fallbackWords[Math.floor(Math.random() * fallbackWords.length)].toUpperCase());
      } finally {
        setLoading(false);
      }
    };
    
    initializeGame();
  }, []);

  // Handle keyboard input
  const handleKeyDown = useCallback((e) => {
    if (gameOver || loading) return;

    const key = e.key.toUpperCase();

    if (key === 'ENTER' && currentGuess.length === WORD_LENGTH) {
      if (!wordList.includes(currentGuess.toLowerCase())) {
        setShake(true);
        setMessage('Not in word list');
        setTimeout(() => {
          setShake(false);
          setMessage('');
        }, 1000);
        return;
      }

      if (currentGuess === targetWord) {
        setGameOver(true);
        setWinAnimation(true);
        setMessage('You won!');
        setGuesses(prev => {
          const newGuesses = [...prev];
          newGuesses[currentRow] = currentGuess;
          return newGuesses;
        });
      } else if (currentRow === MAX_ATTEMPTS - 1) {
        setGameOver(true);
        setMessage(`Game over! The word was ${targetWord}`);
        setGuesses(prev => {
          const newGuesses = [...prev];
          newGuesses[currentRow] = currentGuess;
          return newGuesses;
        });
      } else {
        setGuesses(prev => {
          const newGuesses = [...prev];
          newGuesses[currentRow] = currentGuess;
          return newGuesses;
        });
        setCurrentRow(prev => prev + 1);
        setCurrentGuess('');
      }
      return;
    }

    if (key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
      return;
    }

    if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(prev => prev + key);
    } else if (currentGuess.length >= WORD_LENGTH) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }, [currentGuess, currentRow, gameOver, targetWord, wordList, loading]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const resetGame = () => {
    // Only allow reset if not using the daily word
    if (!wordList.includes(targetWord.toLowerCase())) {
      const randomWord = wordList[Math.floor(Math.random() * wordList.length)].toUpperCase();
      setTargetWord(randomWord);
    }
    setGuesses(Array(MAX_ATTEMPTS).fill(''));
    setCurrentGuess('');
    setCurrentRow(0);
    setGameOver(false);
    setMessage('');
    setWinAnimation(false);
  };

  const getTileColor = (letter, index, guess) => {
    if (!guess || !targetWord) return 'bg-gray-200';

    if (targetWord[index] === letter) {
      return 'bg-green-500 text-white';
    } else if (targetWord.includes(letter)) {
      return 'bg-yellow-500 text-white';
    } else {
      return 'bg-gray-500 text-white';
    }
  };

  const KeyboardKey = ({ children, onClick, className = '', color = '' }) => {
    const baseClasses = 'flex items-center justify-center h-12 m-1 rounded font-bold';
    const colorClasses = color || 'bg-gray-200 hover:bg-gray-300';
    
    return (
      <button
        className={`${baseClasses} ${colorClasses} ${className}`}
        onClick={onClick}
      >
        {children}
      </button>
    );
  };

  const getKeyColor = (key) => {
    for (let i = 0; i < currentRow; i++) {
      const guess = guesses[i];
      if (!guess) continue;
      
      if (targetWord.includes(key)) {
        if (targetWord[guess.indexOf(key)] === key) {
          return 'bg-green-500 hover:bg-green-600 text-white';
        }
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      } else if (guess.includes(key)) {
        return 'bg-gray-500 hover:bg-gray-600 text-white';
      }
    }
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-700">Loading today's word...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">WordQuiz Pro</h1>
      
      <div className="mb-2 text-sm text-gray-600">
        {targetWord && wordList.includes(targetWord.toLowerCase()) ? (
          <span>Today's WordQuiz - {new Date().toLocaleDateString()}</span>
        ) : (
          <span>Practice Mode</span>
        )}
      </div>
      
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center ${
          message.includes('won') ? 'bg-green-100 text-green-800' : 
          message.includes('Game over') ? 'bg-red-100 text-red-800' : 
          'bg-blue-100 text-blue-800'
        }`}>
          <span>{message}</span>
          {gameOver && (
            <button 
              onClick={resetGame}
              className="ml-4 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
            >
              <FaRedo className="mr-2" /> {wordList.includes(targetWord.toLowerCase()) ? 'Practice' : 'Play Again'}
            </button>
          )}
        </div>
      )}

      <div className="mb-8 grid grid-rows-6 gap-2">
        {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-2">
            {Array.from({ length: WORD_LENGTH }).map((_, colIndex) => {
              const guess = rowIndex === currentRow ? currentGuess : guesses[rowIndex];
              const letter = guess?.[colIndex] || '';
              const isCurrentRow = rowIndex === currentRow;
              const isFilled = letter && isCurrentRow;
              const isRevealed = rowIndex < currentRow || (rowIndex === currentRow && gameOver);
              const delay = winAnimation ? colIndex * 300 : 0;
              
              return (
                <div
                  key={colIndex}
                  className={`w-14 h-14 border-2 flex items-center justify-center text-2xl font-bold rounded 
                    ${isCurrentRow && !isFilled ? 'border-gray-400' : 'border-gray-300'}
                    ${shake && isCurrentRow ? 'animate-shake' : ''}
                    ${isRevealed ? getTileColor(letter, colIndex, guesses[rowIndex]) : 'bg-white'}
                    ${winAnimation && rowIndex === currentRow && letter === targetWord[colIndex] ? 
                      `animate-flip bg-green-500 text-white` : ''}
                  `}
                  style={winAnimation ? { 
                    animationDelay: `${delay}ms`,
                    transformStyle: 'preserve-3d'
                  } : {}}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="max-w-md w-full">
        <div className="flex justify-center mb-2">
          {'QWERTYUIOP'.split('').map((key) => (
            <KeyboardKey
              key={key}
              onClick={() => {
                if (currentGuess.length < WORD_LENGTH) {
                  setCurrentGuess(prev => prev + key);
                }
              }}
              color={getKeyColor(key)}
              className="w-10"
            >
              {key}
            </KeyboardKey>
          ))}
        </div>
        <div className="flex justify-center mb-2">
          {'ASDFGHJKL'.split('').map((key) => (
            <KeyboardKey
              key={key}
              onClick={() => {
                if (currentGuess.length < WORD_LENGTH) {
                  setCurrentGuess(prev => prev + key);
                }
              }}
              color={getKeyColor(key)}
              className="w-10"
            >
              {key}
            </KeyboardKey>
          ))}
        </div>
        <div className="flex justify-center">
          <KeyboardKey
            onClick={() => {
              if (currentGuess.length === WORD_LENGTH && !gameOver && !loading) {
                if (!wordList.includes(currentGuess.toLowerCase())) {
                  setShake(true);
                  setMessage('Not in word list');
                  setTimeout(() => {
                    setShake(false);
                    setMessage('');
                  }, 1000);
                  return;
                }

                if (currentGuess === targetWord) {
                  setGameOver(true);
                  setWinAnimation(true);
                  setMessage('You won!');
                  setGuesses(prev => {
                    const newGuesses = [...prev];
                    newGuesses[currentRow] = currentGuess;
                    return newGuesses;
                  });
                } else if (currentRow === MAX_ATTEMPTS - 1) {
                  setGameOver(true);
                  setMessage(`Game over! The word was ${targetWord}`);
                  setGuesses(prev => {
                    const newGuesses = [...prev];
                    newGuesses[currentRow] = currentGuess;
                    return newGuesses;
                  });
                } else {
                  setGuesses(prev => {
                    const newGuesses = [...prev];
                    newGuesses[currentRow] = currentGuess;
                    return newGuesses;
                  });
                  setCurrentRow(prev => prev + 1);
                  setCurrentGuess('');
                }
              } else if (currentGuess.length < WORD_LENGTH) {
                setShake(true);
                setTimeout(() => setShake(false), 500);
              }
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white w-16"
          >
            <FaCheck />
          </KeyboardKey>
          {'ZXCVBNM'.split('').map((key) => (
            <KeyboardKey
              key={key}
              onClick={() => {
                if (currentGuess.length < WORD_LENGTH) {
                  setCurrentGuess(prev => prev + key);
                }
              }}
              color={getKeyColor(key)}
              className="w-10"
            >
              {key}
            </KeyboardKey>
          ))}
          <KeyboardKey
            onClick={() => setCurrentGuess(prev => prev.slice(0, -1))}
            className="bg-red-500 hover:bg-red-600 text-white w-16"
          >
            <FaBackspace />
          </KeyboardKey>
        </div>
        <footer className="mt-10 text-center text-sm text-gray-400">
          Made with ❤️ by <Link href="https://github.com/PatelAbhay550" alt="abhay patel github"><span className="font-semibold text-gray-600">Abhay Raj Patel</span></Link>
        </footer>
      </div>
    </div>
  );
}
