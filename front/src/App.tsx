import React from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ProfilePage from "./page/profile/ProfilePage";
import { CheckoutPage } from "./component/payments/Checkout";
import { SuccessPage } from "./component/payments/Succeess";
import { FailPage } from "./component/payments/Fail";
import CocktailDetail from "./page/cocktail/CocktailDetailPage";
import FoodListPage from "./page/food/FoodListPage";
import ProfileCustomization from "./page/profile/cardcustom/ProfileCustomization";
import ProfileEditPage from "./page/profile/edit/ProfileEditPage";
import Layout from "./page/layout/Layout";
import CocktailListPage from "./page/cocktail/CocktailListPage";
import GlobalStyle from "./page/layout/style/GlobalStyle";
import MainPage from "./page/main/MainPage";
import RecipeDetail from "./page/food/FoodRecipeDetail";
import AddRecipeDetail from "./page/RecipeUpload/AddRecipeDetail";
import AddCockTailDetail from "./page/RecipeUpload/AddCockTailDetail";
import RecipeTypeSelect from "./page/food/RecipeTypeSelect";
import EditRecipeDetail from "./page/RecipeUpload/EditRecipeDetail";
import EditCockTailRecipe from "./page/RecipeUpload/EditCocktailRecipe";
// import RecipeUploader from "./page/AddRecipeDetail";

// import Forum from "./page/forum/Forum";

// import PostDetail from ya"./page/forum/PostDetail/PostDetail";
// import CreatePost from "./page/forum/CreatePost";
// import ForumPosts from "./page/forum/ForumPosts";
import Forum from "./page/forum/Forum";
import PostDetail from "./page/forum/PostDetail/PostDetail";
import CreatePost from "./page/forum/CreatePost";
import ForumPosts from "./page/forum/ForumPosts";
import AdminNav from "./page/admin/AdminNav";
import AdminMain from "./page/admin/AdminMain";
import MemberControlMain from "./page/admin/member/list/MemberControlMain";
import AdminStore from "./context/AdminStore";
import MemberItemMain from "./page/admin/member/item/MemberItemMain";

function App() {
  return (
    // 라이트 모드: bg-white, 다크 모드: bg-[#2B1D0E], 전체 화면 높이
    <div className="bg-white dark:bg-[#2B1D0E] min-h-screen transition-colors">
      <GlobalStyle />
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Router>
        <Routes>
          <Route path="/" element={<Layout/>}>
            <Route path="main" element={<MainPage />} />
            {/*프로필 페이지*/}
            <Route path="profile/:id?" element={<ProfilePage />} />
            {/*프로필 페이지에서 id가 있으면 다른 사람의 프로필을 볼 수 있게*/}
            <Route path="profile/cardcustom" element={<ProfileCustomization />}/>
            <Route
              path="profile/cardcustom"
              element={<ProfileCustomization />}
            />
            <Route path="profile/edit" element={<ProfileEditPage />} />

            {/* 레시피 페이지 (라우트 경로 수정됨) */}
            <Route path="recipe/:index" element={<CocktailListPage />} />
            {/*컴포넌트를 같은 컴포넌트를 쓰되 index를 다르게 해서 관리하기*/}
            <Route path="recipe/food" element={<FoodListPage />} />

            <Route path="/foodrecipe/edit/:id/:type" element={<EditRecipeDetail />} />
            <Route path="/cocktailrecipe/edit/:id/:type" element={<EditCockTailRecipe/>} />

            <Route path="foodrecipe/detail/:id/:type" element={<RecipeDetail/>} />
            <Route path="cocktailrecipe/detail/:id/:type" element={<CocktailDetail />} />
            <Route path="/recipe/typeselect" element={<RecipeTypeSelect/>}/>

            {/* 포럼 게시판 페이지 */}
            <Route path="/forum" element={<Forum />} />
            <Route path="/forum/post/:postId" element={<PostDetail />} />
            <Route path="/forum/create-post" element={<CreatePost />} />
            <Route
              path="/forum/category/:categoryId"
              element={<ForumPosts />}
            />
            <Route path="foodrecipe/upload" element={<AddRecipeDetail />} />
            <Route path="cocktailrecipe/upload" element={< AddCockTailDetail/>} />
        
            <Route path="foodrecipe/upload" element={<AddRecipeDetail />} />

            <Route path="cocktailrecipe/upload" element={< AddCockTailDetail/>} />

            {/*관리자 페이지*/}
            <Route path="admin" element={<AdminStore><AdminNav/></AdminStore>}>
              <Route path="" element={<AdminMain/>}/>
              <Route path="member/:search?" element={<MemberControlMain/>}/>
              <Route path="member/detail/:id" element={<MemberItemMain/>}/>
            </Route>
          </Route>
          {/* 결제 페이지 */}
          <Route path="/pay" element={<CheckoutPage />} />
          {/* /sandbox 경로에 CheckoutPage 연결 */}
          <Route path="/pay/success" element={<SuccessPage />} />
          {/* /sandbox/success 경로에 SuccessPage 연결 */}
          <Route path="/pay/fail" element={<FailPage />} />
          {/* /sandbox/fail 경로에 FailPage 연결 */}
        </Routes>
      </Router>
    </div>
  );
}

export default App;
