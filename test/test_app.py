import unittest
from app import haversine_distance

class TestHaversineDistance(unittest.TestCase):
    def test_known_distance(self):
        x1, y1 = 19.9368564, 50.0619474  # Kraków
        x2, y2 = 21.0122287, 52.2296756  # Warszawa

        distance = haversine_distance(x1, y1, x2, y2)

        self.assertAlmostEqual(distance, 252000, delta=1000)

if __name__ == '__main__':
    unittest.main()