import { 
  collection, addDoc, query, where, orderBy, 
  limit, getDocs, serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebase";

const COLLECTION = "predictions";

/**
 * Save a prediction to Firestore for the current user.
 */
export async function savePrediction(userId, flightData, result) {
  try {
    await addDoc(collection(db, COLLECTION), {
      userId,
      airline: flightData.Airline,
      from: flightData.AirportFrom,
      to: flightData.AirportTo,
      dayOfWeek: flightData.DayOfWeek,
      time: flightData.Time,
      length: flightData.Length,
      model: result.model_used || "ensemble",
      prediction: result.prediction,
      probability: result.probability,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Firestore save failed:", err.message);
  }
}

/**
 * Fetch the last N predictions for a user.
 */
export async function fetchUserPredictions(userId, count = 10) {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("Firestore fetch failed:", err.message);
    return [];
  }
}
