# 🚌 Bus Location Simulator - Quick Demo Guide

## Overview

A visual, user-friendly simulator to demonstrate the proximity and missed bus alert system without needing real GPS hardware.

## Location

**Admin Dashboard** → Top of page (below Overview Stats)

## Features

### 1. **Proximity Alert Simulation**
- Simulates a bus approaching from 5km away
- Bus moves incrementally towards the student's location
- Triggers proximity alert when bus reaches 2km threshold
- Shows real-time distance updates via toast notifications
- Browser notification appears when alert is triggered

### 2. **Missed Bus Alert Simulation**
- **Phase 1:** Bus approaches the student's stop (3km → 200m)
- **Phase 2:** Bus stops at location for 2+ minutes
- **Phase 3:** Bus leaves the stop
- Triggers missed bus alert if student not detected on board
- Parent receives notification with response options

## How to Use

### Step 1: Access the Simulator
1. Login to admin dashboard
2. Scroll to top of page
3. Find "Bus Location Simulator (Demo)" card

### Step 2: Select Student & Bus
1. Choose a student from the dropdown
2. Choose a bus from the dropdown

### Step 3: Run Simulation

#### For Proximity Alert:
1. Click **"Bus Approaching"** button (blue)
2. Watch toast notifications showing distance updates
3. Browser notification appears when bus is within 2km
4. Check "Bus Proximity Alerts" section for the alert card

#### For Missed Bus Alert:
1. Click **"Bus Missed"** button (red)
2. Watch the 3-phase simulation:
   - Phase 1: Bus approaching
   - Phase 2: Bus stopped (2+ mins)
   - Phase 3: Bus leaving
3. Browser notification appears
4. Check "Missed Bus Alerts" section
5. Switch to parent dashboard to see response options

### Step 4: Test Parent Response (Missed Bus Only)
1. Login as the student's parent
2. See the missed bus alert card (orange)
3. Click response button:
   - ✓ "I will drop personally"
   - ✗ "Absent today"
4. Card turns green showing response submitted
5. Toast confirmation appears

## Visual Indicators

### Simulation States:
- **Ready:** Dropdown selections enabled
- **Simulating:** Orange "Simulating..." badge with animation
- **Complete:** Green toast "Simulation Complete"

### Alert Cards:
- **Proximity Alert:** Blue card with 📍 icon
- **Missed Bus (Pending):** Orange card with ⚠️ icon
- **Missed Bus (Responded):** Green card with ✅ icon

## Demo Script (5 Minutes)

### Part 1: Proximity Alert (2 mins)
```
1. "Let me show you our proximity alert system"
2. Select student: "Sarah Johnson"
3. Select bus: "Bus-01"
4. Click "Bus Approaching"
5. "Watch as the bus moves from 5km away..."
6. [Toast notifications show distance updates]
7. "When the bus reaches 2km, parents get notified!"
8. [Browser notification appears]
9. "Here's the alert card showing the distance and time"
```

### Part 2: Missed Bus Alert (3 mins)
```
1. "Now let's simulate a missed bus scenario"
2. Keep same student and bus selected
3. Click "Bus Missed"
4. "Phase 1: Bus approaching the stop..."
5. "Phase 2: Bus stopped at location for 2 minutes..."
6. "Phase 3: Bus is leaving without the student..."
7. [Browser notification appears]
8. "Parents get this alert immediately"
9. Switch to parent dashboard
10. "Parents can respond right here with two options"
11. Click "I will drop personally"
12. "Status updates across all systems instantly!"
```

## Tips for Best Demo Experience

### Before Demo:
- ✅ Enable browser notifications (allow when prompted)
- ✅ Keep both admin and parent dashboard tabs open
- ✅ Check that Firebase is connected
- ✅ Ensure student has coordinates in Firebase

### During Demo:
- 📢 Explain each phase as it happens
- 👀 Show both admin view and parent view
- 🔔 Make sure browser notifications are visible
- ⏱️ Let simulations complete (don't interrupt)

### Common Issues:
- **No notifications?** → Check browser permission settings
- **Dropdowns empty?** → Refresh page, check Firebase connection
- **Simulation stuck?** → Click "Stop Simulation" and retry
- **No alerts appearing?** → Check console for errors

## What's Happening Behind the Scenes

### Proximity Alert:
1. Simulator updates bus location in Firebase every 1 second
2. BusProximityAlerts component checks distance every 15 seconds
3. When distance ≤ 2km → creates alert in Firebase
4. Browser notification sent via Notification API
5. Alert card appears in real-time via Firebase listener

### Missed Bus Alert:
1. Bus approaches and stops within 300m of student
2. Waits 2+ minutes (simulated as 5 seconds)
3. Bus starts moving away
4. System checks if student is on board (attendance)
5. If not found → creates missed bus alert
6. Parent receives notification
7. Response updates Firebase and student status

## Firebase Structure

The simulator updates these paths:

```
buses/
  {busId}/
    currentLocation/
      latitude: number
      longitude: number
      timestamp: number
      speed: number
      heading: number

proximityAlerts/
  {studentId}-{busId}/
    studentId, studentName, busId, distance, timestamp, notified

missedBusAlerts/
  missed-{studentId}-{busId}-{date}/
    studentId, studentName, busId, busName, parentId, timestamp
    parentResponse, responseTimestamp
```

## Demo Video Script

```
[00:00] "Welcome to GuardianTrack's intelligent bus tracking system"
[00:10] "Let me demonstrate our proximity and missed bus alerts"
[00:20] *Select student and bus*
[00:30] "Watch as the bus approaches..." *Click Bus Approaching*
[00:45] *Show distance updates in toasts*
[01:00] "At 2km, parents get notified!" *Show browser notification*
[01:15] "Now for the missed bus scenario" *Click Bus Missed*
[01:30] "Bus approaches... stops... waits... then leaves"
[02:00] "Parent gets an immediate alert" *Show notification*
[02:15] *Switch to parent dashboard*
[02:30] "Parents can respond instantly" *Click response button*
[02:45] "Status updates everywhere automatically!"
[03:00] "That's GuardianTrack - keeping students safe!"
```

## Next Steps After Demo

1. **Configure Real GPS:**
   - Replace simulator with actual bus GPS devices
   - Set up automatic location updates every 10-15 seconds

2. **Production Settings:**
   - Update Firebase security rules
   - Configure proper authentication
   - Set up monitoring and alerts

3. **Customization:**
   - Adjust proximity threshold (currently 2km)
   - Modify check interval (currently 15 seconds)
   - Customize notification messages

## Support

If you encounter issues during demo:
- Check browser console for errors
- Verify Firebase connection
- Ensure notifications are enabled
- Try refreshing the page

For production deployment, refer to:
- `BUS_PROXIMITY_ALERTS_GUIDE.md`
- `TESTING_GUIDE.md`
- `IMPLEMENTATION_SUMMARY.md`

---

**Quick Test:**
1. Select student: "Sarah Johnson"
2. Select bus: "bus_01"
3. Click "Bus Approaching"
4. Watch for notification!

🎉 **Demo-ready in 30 seconds!**
