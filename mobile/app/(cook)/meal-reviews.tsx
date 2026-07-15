import { Stack } from 'expo-router';
import { MealReviewsView } from '@/src/components/MealReviewsView';

export default function CookMealReviews() {
  return (
    <>
      <Stack.Screen options={{ title: 'Meal Reviews' }} />
      <MealReviewsView role="cook" />
    </>
  );
}
