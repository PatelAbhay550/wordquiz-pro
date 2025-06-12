"use client"
import { useState, useEffect, useCallback } from 'react';
import { FaBackspace, FaCheck, FaRedo, FaQuestionCircle, FaTimes } from 'react-icons/fa';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useCookies } from 'react-cookie';

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

// Helper function to get today's date key (YYYY-MM-DD)
const getTodayKey = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const WordDetailsPopup = ({ details, onClose }) => {
  if (!details) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{details.word}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes size={20} />
          </button>
        </div>
        
        {details.phonetic && (
          <div className="mb-4">
            <span className="text-gray-600">Pronunciation: </span>
            <span className="font-mono">{details.phonetic}</span>
          </div>
        )}
        
        {details.hindi && (
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <h3 className="font-semibold text-blue-800 mb-1">Hindi Meaning</h3>
            <p className="text-lg">{details.hindi}</p>
          </div>
        )}
        
        <div className="space-y-4">
          {details.meanings?.map((meaning, index) => (
            <div key={index}>
              <h3 className="font-semibold text-lg capitalize">{meaning.partOfSpeech}</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {meaning.definitions?.slice(0, 3).map((def, defIndex) => (
                  <li key={defIndex}>
                    <p>{def.definition}</p>
                    {def.example && (
                      <p className="text-gray-600 italic">Example: "{def.example}"</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <button
          onClick={onClose}
          className="mt-6 w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
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
  const [showInstructions, setShowInstructions] = useState(false);
  const [wordDetails, setWordDetails] = useState(null);
  const [completedToday, setCompletedToday] = useState(false);
  const [cookies, setCookie] = useCookies(['hasSeenInstructions']);

  const fetchWordDetails = async (word) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
      const data = await response.json();
      
      if (data && data[0]) {
        const details = {
          word: word,
          meanings: data[0].meanings,
          phonetic: data[0].phonetic,
          hindi: null
        };
        
        try {
          const hindiResponse = await fetch(`https://api.mymemory.translated.net/get?q=${word}&langpair=en|hi`);
          const hindiData = await hindiResponse.json();
          if (hindiData && hindiData.responseData) {
            details.hindi = hindiData.responseData.translatedText;
          }
        } catch (hindiError) {
          console.log("Couldn't fetch Hindi translation");
        }
        
        setWordDetails(details);
        return details;
      }
    } catch (error) {
      console.error("Error fetching word details:", error);
    }
    return null;
  };

  // Show instructions on first visit
  useEffect(() => {
    if (!cookies.hasSeenInstructions) {
      setShowInstructions(true);
      setCookie('hasSeenInstructions', 'true', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    }
  }, [cookies.hasSeenInstructions, setCookie]);

  // Check for completed game
  useEffect(() => {
    const todayKey = getTodayKey();
    const completed = localStorage.getItem(`completed_${todayKey}`);
    if (completed) {
      setCompletedToday(true);
      const savedDetails = localStorage.getItem(`details_${todayKey}`);
      if (savedDetails) {
        setWordDetails(JSON.parse(savedDetails));
      }
    }
  }, []);

  // Load word list and today's word
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // 1. Load word list
        const response = await fetch(
          "https://gist.githubusercontent.com/dracos/dd0668f281e685bad51479e5acaadb93/raw/6bfa15d263d6d5b63840a8e5b64e04b382fdb079/valid-wordle-words.txt"
        );
        const text = await response.text();
       const words = text.split('\n').map(w => w.trim()).filter(word => word.length === WORD_LENGTH);
        

        setWordList(words);
        
        // 2. Check Firebase for today's word
        const todayKey = getTodayKey();
        const wordDocRef = doc(db, 'dailyWords', todayKey);
        const docSnap = await getDoc(wordDocRef);
        
        if (docSnap.exists()) {
          setTargetWord(docSnap.data().word.toUpperCase());
        } else {
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
        const fallbackWords = ['REACT', 'NEXTJS', 'HOOKS', 'GAMES', 'CODER'];
        setWordList(fallbackWords);
        setTargetWord(fallbackWords[Math.floor(Math.random() * fallbackWords.length)].toUpperCase());
      } finally {
        setLoading(false);
      }
    };
    
    initializeGame();
  }, []);

  const handleGameCompletion = async (isWin) => {
    const todayKey = getTodayKey();
    localStorage.setItem(`completed_${todayKey}`, 'true');
    setCompletedToday(true);
    
    const details = await fetchWordDetails(targetWord);
    if (details) {
      localStorage.setItem(`details_${todayKey}`, JSON.stringify(details));
    }
    
    setGameOver(true);
    if (isWin) {
      setWinAnimation(true);
      setMessage('You won!');
    } else {
      setMessage(`Game over! The word was ${targetWord}`);
    }
  };

  // Handle keyboard input
  const handleKeyDown = useCallback((e) => {
    if (gameOver || loading || completedToday) return;

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
        handleGameCompletion(true);
        setGuesses(prev => {
          const newGuesses = [...prev];
          newGuesses[currentRow] = currentGuess;
          return newGuesses;
        });
      } else if (currentRow === MAX_ATTEMPTS - 1) {
        handleGameCompletion(false);
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
  }, [currentGuess, currentRow, gameOver, targetWord, wordList, loading, completedToday]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const resetGame = () => {
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
    setWordDetails(null);
    setCompletedToday(false);
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
    for (let i = 0; i <= currentRow; i++) {
      const guess = guesses[i];
      if (!guess) continue;
      
      if (guess.includes(key)) {
        if (targetWord.includes(key)) {
          for (let j = 0; j < guess.length; j++) {
            if (guess[j] === key && targetWord[j] === key) {
              return 'bg-green-500 hover:bg-green-600 text-white';
            }
          }
          return 'bg-yellow-500 hover:bg-yellow-600 text-white';
        } else {
          return 'bg-gray-500 hover:bg-gray-600 text-white';
        }
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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4 relative">
      {/* How to Play Button */}
      <button
        onClick={() => setShowInstructions(true)}
        className="fixed top-4 right-4 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
        aria-label="How to play"
      >
        <FaQuestionCircle size={24} />
      </button>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">How to Play WordQuiz Pro</h2>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Guess the Word</h3>
                <p>You have {MAX_ATTEMPTS} attempts to guess a {WORD_LENGTH}-letter word.</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg">Feedback Colors</h3>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white font-bold">R</div>
                  <span>Letter is correct and in the right position</span>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center text-white font-bold">E</div>
                  <span>Letter is correct but in the wrong position</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-500 rounded flex items-center justify-center text-white font-bold">A</div>
                  <span>Letter is not in the word at all</span>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg">Daily Challenge</h3>
                <p>Everyone gets the same word each day. Come back tomorrow for a new challenge!</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg">Practice Mode</h3>
                <p>When not playing the daily word, you can practice with random words.</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowInstructions(false)}
              className="mt-6 w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Word Details Popup */}
      {wordDetails && (
        <WordDetailsPopup 
          details={wordDetails} 
          onClose={() => setWordDetails(null)} 
        />
      )}

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

      <div className="mb-8 grid grid-rows-6 gap-2 relative">
        {completedToday && (
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-10 rounded-lg">
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-lg font-semibold mb-2">You've completed today's WordQuiz!</p>
              <p className="mb-4">Come back tomorrow for a new challenge!</p>
              <button
                onClick={() => {
                  setWordDetails(null);
                  resetGame();
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Practice with Random Words
              </button>
            </div>
          </div>
        )}
        
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
                if (currentGuess.length < WORD_LENGTH && !completedToday) {
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
                if (currentGuess.length < WORD_LENGTH && !completedToday) {
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
              if (currentGuess.length === WORD_LENGTH && !gameOver && !loading && !completedToday) {
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
                  handleGameCompletion(true);
                  setGuesses(prev => {
                    const newGuesses = [...prev];
                    newGuesses[currentRow] = currentGuess;
                    return newGuesses;
                  });
                } else if (currentRow === MAX_ATTEMPTS - 1) {
                  handleGameCompletion(false);
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
            <FaCheck className="text-green-600"/>
          </KeyboardKey>
          {'ZXCVBNM'.split('').map((key) => (
            <KeyboardKey
              key={key}
              onClick={() => {
                if (currentGuess.length < WORD_LENGTH && !completedToday) {
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
            onClick={() => !completedToday && setCurrentGuess(prev => prev.slice(0, -1))}
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
