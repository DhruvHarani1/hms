import { Stack } from 'expo-router';
import { MealReviewsView } from '@/src/components/MealReviewsView';

export default function WardenMealReviews() {
  return (
    <>
      <Stack.Screen options={{ title: 'Meal Reviews' }} />
      <MealReviewsView role="warden" />
    </>
  );
}
