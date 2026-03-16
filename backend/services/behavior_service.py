import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from collections import Counter
import hashlib
import re

class BehaviorService:
    """Service for tracking user behavior and detecting anomalies."""

    def __init__(self):
        # Thresholds for anomaly detection
        self.thresholds = {
            'time_zscore': 2.5,           # Z-score threshold for time anomalies
            'location_change': 500,        # km - threshold for impossible travel
            'new_device_confidence': 5,    # minimum sessions to establish baseline
            'min_samples': 3               # minimum samples for baseline calculation
        }

    def analyze_login(self, user_id: str, session_data: dict, db) -> Tuple[bool, List[str], Dict]:
        """
        Analyze a login session for anomalies.
        Returns: (is_anomaly, reasons, risk_score)
        """
        reasons = []
        risk_factors = {}

        # Get user's historical sessions
        from utils.database import get_user_sessions
        historical_sessions = get_user_sessions(user_id, limit=100)

        # If not enough history, just record the session
        if len(historical_sessions) < self.thresholds['min_samples']:
            return False, ["insufficient_history"], {"overall_risk": 0.0}

        # Check various anomaly types
        time_anomaly, time_risk = self._check_time_anomaly(session_data, historical_sessions)
        if time_anomaly:
            reasons.append("unusual_login_time")
            risk_factors['time_risk'] = time_risk

        location_anomaly, location_risk = self._check_location_anomaly(session_data, historical_sessions)
        if location_anomaly:
            reasons.append("unusual_location")
            risk_factors['location_risk'] = location_risk

        device_anomaly, device_risk = self._check_device_anomaly(session_data, historical_sessions)
        if device_anomaly:
            reasons.append("new_device")
            risk_factors['device_risk'] = device_risk

        pattern_anomaly, pattern_risk = self._check_behavior_pattern(session_data, historical_sessions)
        if pattern_anomaly:
            reasons.append("behavior_pattern_change")
            risk_factors['pattern_risk'] = pattern_risk

        # Calculate overall risk score
        overall_risk = self._calculate_overall_risk(risk_factors)

        is_anomaly = len(reasons) > 0
        return is_anomaly, reasons, {"overall_risk": overall_risk, **risk_factors}

    def _check_time_anomaly(self, session_data: dict, historical_sessions: List[dict]) -> Tuple[bool, float]:
        """Check if login time is unusual based on historical patterns."""
        try:
            current_hour = datetime.utcnow().hour

            # Extract hours from historical sessions
            historical_hours = []
            for session in historical_sessions:
                if 'login_time' in session:
                    login_time = session['login_time']
                    if isinstance(login_time, str):
                        login_time = datetime.fromisoformat(login_time.replace('Z', '+00:00'))
                    historical_hours.append(login_time.hour)

            if len(historical_hours) < self.thresholds['min_samples']:
                return False, 0.0

            # Calculate statistics
            mean_hour = np.mean(historical_hours)
            std_hour = np.std(historical_hours)

            if std_hour == 0:
                std_hour = 1  # Avoid division by zero

            # Handle circular nature of hours (23:00 is close to 00:00)
            hour_diff = min(
                abs(current_hour - mean_hour),
                abs(current_hour - mean_hour + 24),
                abs(current_hour - mean_hour - 24)
            )

            z_score = hour_diff / std_hour

            if z_score > self.thresholds['time_zscore']:
                risk_score = min(z_score / 4.0, 1.0)  # Normalize to 0-1
                return True, risk_score

            return False, 0.0

        except Exception as e:
            print(f"Error checking time anomaly: {e}")
            return False, 0.0

    def _check_location_anomaly(self, session_data: dict, historical_sessions: List[dict]) -> Tuple[bool, float]:
        """Check if location is unusual or involves impossible travel."""
        try:
            current_country = session_data.get('location_country')
            current_city = session_data.get('location_city')

            if not current_country:
                return False, 0.0

            # Get historical locations
            historical_countries = []
            for session in historical_sessions:
                if session.get('location_country'):
                    historical_countries.append(session['location_country'])

            if len(historical_countries) < self.thresholds['min_samples']:
                return False, 0.0

            # Check if this is a new country
            country_counts = Counter(historical_countries)
            total_sessions = len(historical_countries)

            if current_country not in country_counts:
                # Completely new country - high risk
                return True, 0.8

            # Check frequency of this country
            country_frequency = country_counts[current_country] / total_sessions

            if country_frequency < 0.1:  # Less than 10% of logins
                # Rare location
                return True, 0.5

            # Check for impossible travel (if we had precise coordinates)
            # For now, we'll do a simple check on last login time
            if historical_sessions:
                last_session = historical_sessions[0]
                if last_session.get('location_country') != current_country:
                    # Country changed - check time difference
                    last_time = last_session.get('login_time')
                    current_time = datetime.utcnow()

                    if isinstance(last_time, str):
                        last_time = datetime.fromisoformat(last_time.replace('Z', '+00:00'))

                    time_diff_hours = (current_time - last_time).total_seconds() / 3600

                    # If country changed within 2 hours, flag as suspicious
                    if time_diff_hours < 2:
                        return True, 0.9

            return False, 0.0

        except Exception as e:
            print(f"Error checking location anomaly: {e}")
            return False, 0.0

    def _check_device_anomaly(self, session_data: dict, historical_sessions: List[dict]) -> Tuple[bool, float]:
        """Check if device is new or unusual."""
        try:
            current_fingerprint = session_data.get('device_fingerprint')
            user_agent = session_data.get('user_agent', '')

            if not current_fingerprint and not user_agent:
                return False, 0.0

            # Get historical devices
            historical_devices = set()
            for session in historical_sessions:
                if session.get('device_fingerprint'):
                    historical_devices.add(session['device_fingerprint'])

            if len(historical_devices) < self.thresholds['min_samples']:
                return False, 0.0

            # Check if this is a new device
            if current_fingerprint and current_fingerprint not in historical_devices:
                return True, 0.6

            # Check for suspicious user agent patterns
            suspicious_patterns = [
                'headless', 'bot', 'crawler', 'scraper',
                'python-requests', 'curl', 'wget'
            ]

            user_agent_lower = user_agent.lower()
            for pattern in suspicious_patterns:
                if pattern in user_agent_lower:
                    return True, 0.7

            return False, 0.0

        except Exception as e:
            print(f"Error checking device anomaly: {e}")
            return False, 0.0

    def _check_behavior_pattern(self, session_data: dict, historical_sessions: List[dict]) -> Tuple[bool, float]:
        """Check for unusual behavior patterns."""
        try:
            # Calculate average session duration
            durations = []
            for session in historical_sessions:
                if session.get('session_duration'):
                    durations.append(session['session_duration'])

            if len(durations) < self.thresholds['min_samples']:
                return False, 0.0

            avg_duration = np.mean(durations)
            std_duration = np.std(durations)

            # Check current session (if duration is provided)
            current_duration = session_data.get('session_duration', 0)
            if current_duration > 0 and std_duration > 0:
                z_score = abs(current_duration - avg_duration) / std_duration

                if z_score > self.thresholds['time_zscore']:
                    return True, min(z_score / 4.0, 1.0)

            return False, 0.0

        except Exception as e:
            print(f"Error checking behavior pattern: {e}")
            return False, 0.0

    def _calculate_overall_risk(self, risk_factors: Dict[str, float]) -> float:
        """Calculate overall risk score from individual factors."""
        if not risk_factors:
            return 0.0

        # Weight the risk factors
        weights = {
            'time_risk': 0.25,
            'location_risk': 0.35,
            'device_risk': 0.25,
            'pattern_risk': 0.15
        }

        total_weight = 0
        weighted_sum = 0

        for factor, weight in weights.items():
            if factor in risk_factors:
                weighted_sum += risk_factors[factor] * weight
                total_weight += weight

        if total_weight == 0:
            return 0.0

        return min(weighted_sum / total_weight, 1.0)

    def generate_baseline(self, user_id: str, db) -> Dict[str, Any]:
        """Generate behavior baseline for a user based on historical data."""
        from utils.database import get_user_sessions

        sessions = get_user_sessions(user_id, limit=100)

        if len(sessions) < self.thresholds['min_samples']:
            return {
                "status": "insufficient_data",
                "message": f"Need at least {self.thresholds['min_samples']} sessions to establish baseline",
                "current_sessions": len(sessions)
            }

        baseline = {
            "status": "established",
            "patterns": {}
        }

        # Time pattern
        hours = [s['login_time'].hour if isinstance(s['login_time'], datetime)
                 else datetime.fromisoformat(str(s['login_time']).replace('Z', '+00:00')).hour
                 for s in sessions if s.get('login_time')]

        if hours:
            baseline["patterns"]["login_time"] = {
                "mean_hour": float(np.mean(hours)),
                "std_hour": float(np.std(hours)),
                "common_hours": [int(h) for h in Counter(hours).most_common(5)],
                "confidence": min(len(hours) / 20.0, 1.0)  # Max confidence at 20 samples
            }

        # Location pattern
        countries = [s.get('location_country') for s in sessions if s.get('location_country')]
        if countries:
            country_dist = Counter(countries)
            total = len(countries)
            baseline["patterns"]["location"] = {
                "common_countries": [
                    {"country": c, "frequency": count/total}
                    for c, count in country_dist.most_common(3)
                ],
                "confidence": min(len(countries) / 10.0, 1.0)
            }

        # Device pattern
        devices = [s.get('device_fingerprint') for s in sessions if s.get('device_fingerprint')]
        if devices:
            baseline["patterns"]["device"] = {
                "known_devices": len(set(devices)),
                "total_sessions": len(devices),
                "confidence": min(len(devices) / self.thresholds['new_device_confidence'], 1.0)
            }

        return baseline

    def get_behavior_summary(self, user_id: str, db) -> Dict[str, Any]:
        """Get a summary of user's behavior patterns and recent anomalies."""
        from utils.database import get_user_sessions, get_user_anomalies

        sessions = get_user_sessions(user_id, limit=50)
        anomalies = get_user_anomalies(user_id, include_acknowledged=False)

        # Calculate statistics
        total_sessions = len(sessions)
        anomaly_count = len(anomalies)

        # Get unique devices
        devices = set(s.get('device_fingerprint') for s in sessions if s.get('device_fingerprint'))
        countries = set(s.get('location_country') for s in sessions if s.get('location_country'))

        # Calculate average session duration
        durations = [s.get('session_duration', 0) for s in sessions if s.get('session_duration')]
        avg_duration = np.mean(durations) if durations else 0

        return {
            "total_sessions": total_sessions,
            "unique_devices": len(devices),
            "unique_countries": len(countries),
            "average_session_duration": round(avg_duration, 2),
            "active_anomalies": anomaly_count,
            "recent_anomalies": anomalies[:5],
            "baseline_status": "established" if total_sessions >= self.thresholds['min_samples'] else "learning"
        }

    def create_device_fingerprint(self, user_agent: str, ip_address: str = None) -> str:
        """Create a device fingerprint from user agent and IP."""
        fingerprint_data = f"{user_agent}:{ip_address or ''}"
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()[:32]
