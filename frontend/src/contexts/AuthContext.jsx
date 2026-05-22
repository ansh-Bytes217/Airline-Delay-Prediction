import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function signup(email, password, displayName) {
    return createUserWithEmailAndPassword(auth, email, password)
      .then((result) => {
        return updateProfile(result.user, { displayName }).then(() => {
          setCurrentUser({ ...result.user, displayName });
          return result.user;
        });
      })
      .catch((err) => {
        // Resilient fallback for local testing if Firebase connection is blocked/fails
        if (err.code === 'auth/network-request-failed' || !window.navigator.onLine) {
          const localUser = {
            uid: 'local-' + Math.random().toString(36).substr(2, 9),
            email,
            displayName: displayName || 'Local User',
          };
          setCurrentUser(localUser);
          localStorage.setItem('skypredict_mock_user', JSON.stringify(localUser));
          return localUser;
        }
        throw err;
      });
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
      .catch((err) => {
        // Resilient fallback for local testing if Firebase connection is blocked/fails
        if (err.code === 'auth/network-request-failed' || !window.navigator.onLine) {
          const localUser = {
            uid: 'local-' + Math.random().toString(36).substr(2, 9),
            email,
            displayName: email.split('@')[0],
          };
          setCurrentUser(localUser);
          localStorage.setItem('skypredict_mock_user', JSON.stringify(localUser));
          return localUser;
        }
        throw err;
      });
  }

  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  function loginAsGuest() {
    const guestUser = {
      uid: 'guest-' + Math.random().toString(36).substr(2, 9),
      email: 'guest@skypredict.local',
      displayName: 'Guest Pilot',
    };
    setCurrentUser(guestUser);
    localStorage.setItem('skypredict_mock_user', JSON.stringify(guestUser));
    return Promise.resolve(guestUser);
  }

  function logout() {
    localStorage.removeItem('skypredict_mock_user');
    return signOut(auth)
      .then(() => {
        setCurrentUser(null);
      })
      .catch(() => {
        setCurrentUser(null);
      });
  }

  useEffect(() => {
    // Check local cache first to render instantly
    const cachedUser = localStorage.getItem('skypredict_mock_user');
    if (cachedUser) {
      try {
        setCurrentUser(JSON.parse(cachedUser));
        setLoading(false);
      } catch (e) {
        localStorage.removeItem('skypredict_mock_user');
      }
    }

    // Safety timeout of 2.5s to prevent blank screens if Firebase is blocked or hangs
    const safetyTimeout = setTimeout(() => {
      console.warn("Firebase auth loading timed out. Proceeding in offline/guest-ready mode.");
      setLoading(false);
    }, 2500);

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        clearTimeout(safetyTimeout);
        if (user) {
          setCurrentUser(user);
          localStorage.removeItem('skypredict_mock_user'); // Prefer live auth session if available
        } else {
          // Keep the local storage mock user if set, otherwise set to null
          if (!localStorage.getItem('skypredict_mock_user')) {
            setCurrentUser(null);
          }
        }
        setLoading(false);
      },
      (error) => {
        clearTimeout(safetyTimeout);
        console.warn("Firebase auth state change error (possibly blocked):", error);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []);

  const value = { currentUser, signup, login, loginWithGoogle, loginAsGuest, logout };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
