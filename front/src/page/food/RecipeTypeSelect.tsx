import { useState } from "react";
import React from "react";
import AddCockTailDetail from "../RecipeUpload/AddCockTailDetail";
import AddRecipeDetail from "../RecipeUpload/AddRecipeDetail";

export default function RecipeTypeSelect() {
  const [selectedRecipe, setSelectedRecipe] = useState<"cocktail" | "food">("cocktail");

  return (
    <div className="flex flex-col items-center w-full">
      {/* 헤더 높이만큼 여백 추가 (100px 기준) */}
      <div className="mt-5 w-full bg-white shadow-none p-4 flex justify-center space-x-5 z-5">
        <button
          onClick={() => setSelectedRecipe("food")}
          className={`px-6 py-3 rounded-lg transition ${
            selectedRecipe === "food" ? "bg-[#6a4e23] text-white" : "bg-gray-200"
          }`}
        >
          🍽 음식 레시피 추가
        </button>
        <button
          onClick={() => setSelectedRecipe("cocktail")}
          className={`px-6 py-3 rounded-lg transition ${
            selectedRecipe === "cocktail" ? "bg-[#6a4e23] text-white" : "bg-gray-200"
          }`}
        >
          🍸 칵테일 레시피 추가
        </button>
      </div>

      {/* 입력 폼 (버튼과 겹치지 않도록 추가 여백) */}
      <div className="pt-8 w-full max-w-3xl">
        {selectedRecipe === "cocktail" ? <AddCockTailDetail /> : <AddRecipeDetail />}
      </div>
    </div>
  );
}

