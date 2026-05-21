import pandas as pd
import numpy as np
import random

def generate_data(num_samples=1000):
    airlines = ['WN', 'AA', 'DL', 'OO', 'EV', 'YV', 'UA', 'MQ', 'B6', 'AS', 'NK', 'F9', 'HA', 'VX']
    airports = ['ATL', 'ORD', 'DFW', 'DEN', 'LAX', 'SFO', 'LAS', 'PHX', 'MCO', 'IAH', 'JFK', 'SEA', 'MIA', 'EWR', 'BOS']
    
    data = []
    for i in range(num_samples):
        airline = random.choice(airlines)
        airport_from = random.choice(airports)
        day_of_week = random.randint(1, 7)
        time = random.randint(0, 1439)
        length = random.randint(30, 720)
        flight = random.randint(100, 9999)
        
        # Add some logic so the model actually learns something
        # Higher chance of delay if time is later in the day, or if it's WN/AA, or if length is long
        delay_prob = 0.2
        if time > 1000: delay_prob += 0.2
        if length > 300: delay_prob += 0.1
        if airline in ['WN', 'AA']: delay_prob += 0.1
        if airport_from in ['ATL', 'ORD']: delay_prob += 0.1
        
        delay_class = 1 if random.random() < delay_prob else 0
        
        data.append([flight, airline, airport_from, day_of_week, time, length, delay_class])
        
    df = pd.DataFrame(data, columns=['Flight', 'Airline', 'AirportFrom', 'DayOfWeek', 'Time', 'Length', 'Class'])
    df.to_csv('airlines_delay.csv', index=False)
    print(f"Generated {num_samples} rows in airlines_delay.csv")

if __name__ == "__main__":
    generate_data(5000)
